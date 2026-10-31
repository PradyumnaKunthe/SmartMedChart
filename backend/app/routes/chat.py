from datetime import date, datetime
import json
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.mongo_client import mongo_db
from app.security import require_permission
from app.services.medication_safety_service import (
    check_medication_safety,
)


router = APIRouter(
    prefix="/api/chat",
    tags=["Chatbot"],
)


# =========================================================
# SCHEMAS
# =========================================================

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )


class ChatResponse(BaseModel):
    answer: str
    source: str = "SmartMedChart database"


# =========================================================
# BASIC HELPERS
# =========================================================

def normalize_text(value):
    return str(value or "").strip().lower()


def patient_name(patient):
    if not patient:
        return "Unknown patient"
    if isinstance(patient, dict):
        fn = patient.get("first_name", "")
        ln = patient.get("last_name", "")
    else:
        fn = getattr(patient, "first_name", "")
        ln = getattr(patient, "last_name", "")
    return f"{fn} {ln}".strip() or "Unknown patient"


def format_date(value):
    if value is None:
        return "N/A"
    if isinstance(value, date):
        return value.strftime("%d %b %Y")
    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").strftime("%d %b %Y")
        except Exception:
            return value
    return str(value)


def format_time(value):
    if value is None:
        return "N/A"
    if hasattr(value, "strftime"):
        return value.strftime("%I:%M %p")
    if isinstance(value, str):
        try:
            t_part = value.split(".")[0]
            return datetime.strptime(t_part, "%H:%M:%S").strftime("%I:%M %p")
        except Exception:
            return value
    return str(value)


def format_datetime(value):
    if value is None:
        return "N/A"
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y %I:%M %p")
    if isinstance(value, str):
        try:
            dt_part = value.split(".")[0]
            return datetime.strptime(dt_part, "%Y-%m-%d %H:%M:%S").strftime("%d %b %Y %I:%M %p")
        except Exception:
            return value
    return str(value)


def parse_json_list(value):
    if not value:
        return []

    if isinstance(value, list):
        return value

    try:
        parsed = json.loads(value)

        if isinstance(parsed, list):
            return parsed

        if isinstance(parsed, dict):
            return [
                f"{key}: {item}"
                for key, item in parsed.items()
            ]

        return [str(parsed)]

    except (TypeError, ValueError, json.JSONDecodeError):
        return [str(value)]


# =========================================================
# PATIENT FINDER
# =========================================================

STOPWORDS = {
    "who", "are", "is", "am", "the", "a", "an", "for", "to", "in", "of", "and",
    "or", "how", "what", "when", "why", "where", "there", "patient", "test",
    "schedule", "status", "administration", "medicine", "medication", "has", "have",
}


def find_patient(message: str):
    """
    Find an active patient in MongoDB.
    """

    patients = list(
        mongo_db.patients.find({"is_active": {"$in": [1, True]}})
    )

    text = normalize_text(message)

    # 1. Exact patient-code matches
    for patient in patients:
        code = normalize_text(patient.get("patient_id"))
        if code and code in text:
            return patient

    # 2. Exact full-name matches
    for patient in patients:
        full_name = normalize_text(
            f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
        )
        if full_name and full_name in text:
            return patient

    # 3. Exact first + last tokens
    for patient in patients:
        first_name = normalize_text(patient.get("first_name"))
        last_name = normalize_text(patient.get("last_name"))

        if not first_name or not last_name:
            continue

        first_match = re.search(rf"\b{re.escape(first_name)}\b", text)
        last_match = re.search(rf"\b{re.escape(last_name)}\b", text)

        if first_match and last_match:
            return patient

    # 4. First name only (skip common words)
    for patient in patients:
        first_name = normalize_text(patient.get("first_name"))
        if (
            first_name
            and len(first_name) >= 3
            and first_name not in STOPWORDS
            and re.search(rf"\b{re.escape(first_name)}\b", text)
        ):
            return patient

    # 5. Last name only (skip common words)
    for patient in patients:
        last_name = normalize_text(patient.get("last_name"))
        if (
            last_name
            and len(last_name) >= 3
            and last_name not in STOPWORDS
            and re.search(rf"\b{re.escape(last_name)}\b", text)
        ):
            return patient

    return None


# =========================================================
# PATIENT SUMMARY
# =========================================================

def build_patient_summary(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))

    allergies = list(
        mongo_db.patient_allergies.find({"patient_id": patient_id})
    )

    rx_docs = list(
        mongo_db.prescriptions.find({"patient_id": patient_id})
    )
    rx_ids = [r.get("id", r.get("_id")) for r in rx_docs]

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": {"$in": rx_ids}
        }).sort([("_id", -1)])
    ) if rx_ids else []

    med_ids = list({it.get("medicine_id") for it in items if it.get("medicine_id")})
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {m.get("id", m.get("_id")): m for m in med_docs}

    lines = [
        f"Patient: {patient_name(patient)}",
        f"Patient ID: {patient.get('patient_id')}",
        f"Date of birth: {format_date(patient.get('date_of_birth'))}",
        f"Gender: {patient.get('gender') or 'Not recorded'}",
        f"Weight: {patient.get('weight_kg') if patient.get('weight_kg') is not None else 'Not recorded'} kg",
        f"Ward ID: {patient.get('ward_id') if patient.get('ward_id') is not None else 'Not assigned'}",
        f"Bed ID: {patient.get('bed_id') if patient.get('bed_id') is not None else 'Not assigned'}",
    ]

    if allergies:
        allergy_text = []
        for allergy in allergies:
            name = (
                allergy.get("allergen")
                or allergy.get("allergy")
                or "Unknown allergy"
            )
            allergy_text.append(str(name))
        lines.append("Allergies: " + ", ".join(allergy_text))
    else:
        lines.append("Allergies: None recorded")

    if items:
        lines.append("")
        lines.append("Current / recorded medicines:")
        for item in items:
            medicine = med_map.get(item.get("medicine_id"), {})
            stat_text = "STAT" if bool(item.get("is_stat") in [1, True]) else "Routine"
            med_name = medicine.get("name", "Unknown medicine")

            lines.append(
                f"- {med_name}: "
                f"{item.get('dose') or 'Dose not recorded'}, "
                f"{item.get('route') or 'Route not recorded'}, "
                f"{item.get('frequency') or 'Frequency not recorded'}, "
                f"{item.get('duration_days') or 'Duration not recorded'} days, "
                f"{stat_text}"
            )
    else:
        lines.append("Current medicines: None recorded")

    return "\n".join(lines)


# =========================================================
# FIND PATIENT'S SCHEDULES
# =========================================================

def get_patient_schedule_rows(patient_id: int):
    rx_docs = list(
        mongo_db.prescriptions.find({"patient_id": patient_id})
    )
    rx_ids = [r.get("id", r.get("_id")) for r in rx_docs]

    if not rx_ids:
        return []

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": {"$in": rx_ids}
        })
    )
    items_map = {it.get("id", it.get("_id")): it for it in items}

    med_ids = list({it.get("medicine_id") for it in items if it.get("medicine_id")})
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {m.get("id", m.get("_id")): m for m in med_docs}

    item_ids = list(items_map.keys())
    schedules = list(
        mongo_db.medication_schedules.find({
            "prescription_item_id": {"$in": item_ids}
        }).sort([("scheduled_date", 1), ("scheduled_time", 1)])
    )

    rows = []
    for s in schedules:
        it = items_map.get(s.get("prescription_item_id"), {})
        m = med_map.get(it.get("medicine_id"), {})
        rows.append((s, it, m))

    return rows


# =========================================================
# PATIENT MEDICATION SCHEDULE
# =========================================================

def answer_patient_schedule(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    rows = get_patient_schedule_rows(patient_id)

    if not rows:
        return (
            f"No medication schedules were found "
            f"for {patient_name(patient)}."
        )

    lines = [
        f"Medication schedule for {patient_name(patient)}:"
    ]

    for schedule, item, medicine in rows[:20]:
        stat_text = " | STAT" if bool(item.get("is_stat") in [1, True]) else ""
        med_name = medicine.get("name", "Unknown medicine")

        lines.append(
            f"- {med_name} | "
            f"{format_date(schedule.get('scheduled_date'))} "
            f"{format_time(schedule.get('scheduled_time'))} | "
            f"Status: {schedule.get('status')} | "
            f"Dose: {item.get('dose') or 'N/A'}"
            f"{stat_text}"
        )

    if len(rows) > 20:
        lines.append(
            f"...and {len(rows) - 20} more schedule entries."
        )

    return "\n".join(lines)


# =========================================================
# PATIENT MEDICINES / PRESCRIPTIONS
# =========================================================

def answer_patient_medicines(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    rx_docs = list(
        mongo_db.prescriptions.find({"patient_id": patient_id})
    )
    rx_ids = [r.get("id", r.get("_id")) for r in rx_docs]

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": {"$in": rx_ids}
        }).sort([("_id", -1)])
    ) if rx_ids else []

    if not items:
        return (
            f"No recorded medicines or prescriptions "
            f"were found for {patient_name(patient)}."
        )

    med_ids = list({it.get("medicine_id") for it in items if it.get("medicine_id")})
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {m.get("id", m.get("_id")): m for m in med_docs}

    lines = [
        f"Medicines for {patient_name(patient)}:"
    ]

    for item in items:
        medicine = med_map.get(item.get("medicine_id"), {})
        stat_text = "STAT" if bool(item.get("is_stat") in [1, True]) else "Routine"
        med_name = medicine.get("name", "Unknown medicine")

        lines.append(
            f"- {med_name} | "
            f"Dose: {item.get('dose') or 'N/A'} | "
            f"Route: {item.get('route') or 'N/A'} | "
            f"Frequency: {item.get('frequency') or 'N/A'} | "
            f"Duration: {item.get('duration_days') or 'N/A'} days | "
            f"{stat_text}"
        )

    return "\n".join(lines)


# =========================================================
# PATIENT ADMINISTRATION HISTORY
# =========================================================

def answer_patient_administration(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    schedule_rows = get_patient_schedule_rows(patient_id)
    sched_ids = [s.get("id", s.get("_id")) for s, _, _ in schedule_rows]

    if not sched_ids:
        return (
            f"No medication administration records "
            f"were found for {patient_name(patient)}."
        )

    sched_map = {s.get("id", s.get("_id")): s for s, _, _ in schedule_rows}
    item_map = {s.get("id", s.get("_id")): it for s, it, _ in schedule_rows}
    med_map = {s.get("id", s.get("_id")): m for s, _, m in schedule_rows}

    admins = list(
        mongo_db.medication_administrations.find({
            "medication_schedule_id": {"$in": sched_ids}
        }).sort([("administered_at", -1)])
    )

    if not admins:
        return (
            f"No medication administration records "
            f"were found for {patient_name(patient)}."
        )

    user_ids = list({a.get("administered_by") for a in admins if a.get("administered_by")})
    user_docs = list(
        mongo_db.users.find({
            "$or": [
                {"_id": {"$in": user_ids}},
                {"id": {"$in": user_ids}},
            ]
        })
    ) if user_ids else []
    user_map = {u.get("id", u.get("_id")): u for u in user_docs}

    lines = [
        f"Medication administration history for {patient_name(patient)}:"
    ]

    for adm in admins[:20]:
        sched_id = adm.get("medication_schedule_id")
        med = med_map.get(sched_id, {})
        user = user_map.get(adm.get("administered_by"), {})
        username = user.get("username", "Unknown staff")
        med_name = med.get("name", "Unknown medicine")

        lines.append(
            f"- {med_name} | "
            f"Status: {adm.get('status')} | "
            f"Administered: {format_datetime(adm.get('administered_at'))} | "
            f"By: {username} | "
            f"Notes: {adm.get('notes') or 'None'}"
        )

    if len(admins) > 20:
        lines.append(
            f"...and {len(admins) - 20} more administration records."
        )

    return "\n".join(lines)


# =========================================================
# PATIENT QR HISTORY
# =========================================================

def answer_patient_qr(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    verifications = list(
        mongo_db.qr_verifications.find({
            "patient_id": patient_id
        }).sort([("verified_at", -1)])
    )

    if not verifications:
        return (
            f"No QR verification records "
            f"were found for {patient_name(patient)}."
        )

    sched_ids = list({
        v.get("medication_schedule_id")
        for v in verifications
        if v.get("medication_schedule_id")
    })
    sched_docs = list(
        mongo_db.medication_schedules.find({
            "$or": [
                {"_id": {"$in": sched_ids}},
                {"id": {"$in": sched_ids}},
            ]
        })
    ) if sched_ids else []
    sched_map = {s.get("id", s.get("_id")): s for s in sched_docs}

    item_ids = list({
        s.get("prescription_item_id")
        for s in sched_docs
        if s.get("prescription_item_id")
    })
    item_docs = list(
        mongo_db.prescription_items.find({
            "$or": [
                {"_id": {"$in": item_ids}},
                {"id": {"$in": item_ids}},
            ]
        })
    ) if item_ids else []
    item_map = {it.get("id", it.get("_id")): it for it in item_docs}

    med_ids = list({it.get("medicine_id") for it in item_docs if it.get("medicine_id")})
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {m.get("id", m.get("_id")): m for m in med_docs}

    user_ids = list({v.get("verified_by") for v in verifications if v.get("verified_by")})
    user_docs = list(
        mongo_db.users.find({
            "$or": [
                {"_id": {"$in": user_ids}},
                {"id": {"$in": user_ids}},
            ]
        })
    ) if user_ids else []
    user_map = {u.get("id", u.get("_id")): u for u in user_docs}

    lines = [
        f"QR verification history for {patient_name(patient)}:"
    ]

    for ver in verifications[:20]:
        user = user_map.get(ver.get("verified_by"), {})
        username = user.get("username", "Unknown staff")

        sched = sched_map.get(ver.get("medication_schedule_id"), {})
        item = item_map.get(sched.get("prescription_item_id"), {})
        med = med_map.get(item.get("medicine_id"), {})

        med_name = med.get("name") if med else "Patient QR only"
        med_valid_raw = ver.get("medication_valid")
        medication_valid = (
            "Not checked"
            if med_valid_raw is None
            else ("Valid" if med_valid_raw else "Invalid")
        )

        patient_qr_valid = "Valid" if ver.get("patient_qr_valid") else "Invalid"

        lines.append(
            f"- {format_datetime(ver.get('verified_at'))} | "
            f"Patient QR: {patient_qr_valid} | "
            f"Medication: {med_name} | "
            f"Medication check: {medication_valid} | "
            f"Result: {ver.get('result')} | "
            f"By: {username}"
        )

        if ver.get("message"):
            lines.append(f"  Message: {ver.get('message')}")

    return "\n".join(lines)


# =========================================================
# PATIENT AI RISK
# =========================================================

def answer_patient_ai(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    schedule_rows = get_patient_schedule_rows(patient_id)
    sched_ids = [s.get("id", s.get("_id")) for s, _, _ in schedule_rows]

    if not sched_ids:
        return (
            f"No AI risk predictions were found "
            f"for {patient_name(patient)}."
        )

    sched_map = {s.get("id", s.get("_id")): s for s, _, _ in schedule_rows}
    med_map = {s.get("id", s.get("_id")): m for s, _, m in schedule_rows}

    predictions = list(
        mongo_db.ai_predictions.find({
            "medication_schedule_id": {"$in": sched_ids}
        }).sort([("created_at", -1)])
    )

    if not predictions:
        return (
            f"No AI risk predictions were found "
            f"for {patient_name(patient)}."
        )

    lines = [
        f"AI medication risk for {patient_name(patient)}:"
    ]

    for pred in predictions[:20]:
        sched_id = pred.get("medication_schedule_id")
        sched = sched_map.get(sched_id, {})
        med = med_map.get(sched_id, {})
        med_name = med.get("name", "Unknown medicine")

        delay_prob = float(pred.get("delay_probability") or 0.0)
        missed_prob = float(pred.get("missed_probability") or 0.0)
        delay_percent = round(delay_prob * 100, 1)
        missed_percent = round(missed_prob * 100, 1)

        lines.append(
            f"- {med_name} | "
            f"Scheduled: {format_date(sched.get('scheduled_date'))} {format_time(sched.get('scheduled_time'))} | "
            f"Delay risk: {pred.get('delay_risk_level')} ({delay_percent}%) | "
            f"Missed risk: {pred.get('missed_risk_level')} ({missed_percent}%)"
        )

        delay_reasons = parse_json_list(pred.get("delay_reasons"))
        missed_reasons = parse_json_list(pred.get("missed_reasons"))

        if delay_reasons:
            lines.append(
                "  Delay reasons: "
                + ", ".join(str(r) for r in delay_reasons[:5])
            )
        if missed_reasons:
            lines.append(
                "  Missed-dose reasons: "
                + ", ".join(str(r) for r in missed_reasons[:5])
            )

    return "\n".join(lines)


# =========================================================
# PATIENT SAFETY
# =========================================================

def answer_patient_safety(patient: dict):
    patient_id = patient.get("id", patient.get("_id"))
    schedules = get_patient_schedule_rows(patient_id)

    if not schedules:
        return (
            f"No medication schedules were found "
            f"for {patient_name(patient)}, so there are "
            f"no schedule-specific safety checks to show."
        )

    lines = [
        f"Medication safety for {patient_name(patient)}:"
    ]

    found_any = False

    for schedule, item, medicine in schedules:
        sched_id = schedule.get("id", schedule.get("_id"))
        med_name = medicine.get("name", "Unknown medicine")

        try:
            result = check_medication_safety(schedule_id=sched_id)
        except Exception as error:
            lines.append(
                f"- {med_name} | "
                f"Safety check unavailable for schedule {sched_id}: {error}"
            )
            continue

        found_any = True
        safe = bool(result.get("safe", False))
        severity = result.get("severity", "UNKNOWN")
        message = result.get("message", "")
        warnings = result.get("warnings", [])

        status_text = "SAFE" if safe else "WARNING"

        lines.append(
            f"- {med_name} | "
            f"Schedule {sched_id} | "
            f"{status_text} | Severity: {severity}"
        )

        if message:
            lines.append(f"  Message: {message}")

        for warning in warnings[:5]:
            warning_msg = warning.get("message", "")
            reason = warning.get("reason", "")
            warning_sev = warning.get("severity", "")
            lines.append(f"  Warning [{warning_sev}]: {warning_msg}")
            if reason:
                lines.append(f"  Reason: {reason}")

    if not found_any:
        return (
            f"No completed safety results were available "
            f"for {patient_name(patient)}."
        )

    return "\n".join(lines)


# =========================================================
# PATIENT-SPECIFIC QUESTIONS
# =========================================================

def answer_patient_question(message: str):
    patient = find_patient(message)

    if patient is None:
        return None

    text = normalize_text(message)

    # ADMINISTRATION
    administration_keywords = [
        "administration",
        "administered",
        "administer",
        "given by",
        "who gave",
        "who administered",
        "medication history",
        "administration history",
        "was this medicine given",
        "was the medicine given",
    ]
    if any(k in text for k in administration_keywords):
        return answer_patient_administration(patient)

    # QR VERIFICATION
    qr_keywords = [
        "qr",
        "verification",
        "verified",
        "scan",
        "scanned",
        "patient qr",
        "medication qr",
    ]
    if any(k in text for k in qr_keywords):
        return answer_patient_qr(patient)

    # AI RISK
    ai_keywords = [
        "ai risk",
        "ai prediction",
        "prediction",
        "predictions",
        "risk",
        "delay risk",
        "missed risk",
        "high risk",
        "risk level",
        "why is this medication high risk",
    ]
    if any(k in text for k in ai_keywords):
        return answer_patient_ai(patient)

    # SAFETY
    safety_keywords = [
        "safety",
        "safe",
        "warning",
        "warnings",
        "allergy warning",
        "medication safety",
        "drug safety",
    ]
    if any(k in text for k in safety_keywords):
        return answer_patient_safety(patient)

    # BASIC PATIENT INFORMATION
    basic_keywords = [
        "who is",
        "patient details",
        "patient information",
        "profile",
        "weight",
        "gender",
        "birth",
        "date of birth",
        "age",
        "ward",
        "bed",
        "allerg",
    ]
    if any(w in text for w in basic_keywords):
        return build_patient_summary(patient)

    # MEDICATION SCHEDULE
    schedule_keywords = [
        "schedule",
        "scheduled",
        "due",
        "timing",
        "today",
        "upcoming",
        "next medicine",
        "next medication",
        "when is the medicine",
        "when should the medicine",
    ]
    if any(w in text for w in schedule_keywords):
        return answer_patient_schedule(patient)

    # MEDICINES / PRESCRIPTIONS
    medicine_keywords = [
        "medicine",
        "medicines",
        "medication",
        "medications",
        "prescription",
        "prescriptions",
        "drug",
        "drugs",
    ]
    if any(w in text for w in medicine_keywords):
        return answer_patient_medicines(patient)

    return build_patient_summary(patient)


# =========================================================
# GENERAL DASHBOARD QUESTIONS
# =========================================================

def answer_dashboard_question(message: str):
    text = normalize_text(message)

    total = mongo_db.medication_schedules.count_documents({})
    given = mongo_db.medication_schedules.count_documents({"status": "GIVEN"})
    upcoming = mongo_db.medication_schedules.count_documents({"status": "UPCOMING"})
    delayed = mongo_db.medication_schedules.count_documents({"status": "DELAYED"})
    held = mongo_db.medication_schedules.count_documents({"status": "HELD"})
    refused = mongo_db.medication_schedules.count_documents({"status": "REFUSED"})
    not_given = mongo_db.medication_schedules.count_documents({"status": "NOT_GIVEN"})

    stat_item_docs = list(
        mongo_db.prescription_items.find(
            {"is_stat": {"$in": [1, True]}},
            {"_id": 1, "id": 1},
        )
    )
    stat_item_ids = [it.get("id", it.get("_id")) for it in stat_item_docs]
    stat = (
        mongo_db.medication_schedules.count_documents({
            "prescription_item_id": {"$in": stat_item_ids}
        })
        if stat_item_ids
        else 0
    )

    administration_count = mongo_db.medication_administrations.count_documents({})
    qr_count = mongo_db.qr_verifications.count_documents({})

    high_delay_risk = mongo_db.ai_predictions.count_documents({
        "delay_risk_level": {"$in": ["HIGH", "CRITICAL"]}
    })
    high_missed_risk = mongo_db.ai_predictions.count_documents({
        "missed_risk_level": {"$in": ["HIGH", "CRITICAL"]}
    })

    if "administration" in text or "administered" in text:
        return (
            "SmartMedChart administration summary:\n"
            f"- Administration records: {administration_count}\n"
            f"- GIVEN schedules: {given}\n"
            f"- DELAYED schedules: {delayed}\n"
            f"- HELD schedules: {held}\n"
            f"- REFUSED schedules: {refused}\n"
            f"- NOT GIVEN schedules: {not_given}"
        )

    if "qr" in text or "verification" in text:
        return f"SmartMedChart has {qr_count} QR verification records."

    if "ai risk" in text or "high risk" in text or "risk" in text:
        return (
            "SmartMedChart AI risk summary:\n"
            f"- High delay-risk predictions: {high_delay_risk}\n"
            f"- High missed-dose-risk predictions: {high_missed_risk}"
        )

    if "stat" in text:
        return f"There are {stat} STAT medication schedule entries in SmartMedChart."

    if "delayed" in text:
        return f"There are {delayed} delayed medication schedule entries."

    if "given" in text:
        return f"There are {given} medication schedule entries marked as GIVEN."

    if "upcoming" in text or "pending" in text:
        return f"There are {upcoming} upcoming medication schedule entries."

    if "held" in text:
        return f"There are {held} medication schedule entries marked as HELD."

    if "refused" in text:
        return f"There are {refused} medication schedule entries marked as REFUSED."

    if "not given" in text or "not_given" in text:
        return f"There are {not_given} medication schedule entries marked as NOT GIVEN."

    if any(
        w in text
        for w in [
            "how many",
            "total",
            "statistics",
            "dashboard",
            "summary",
            "overview",
        ]
    ):
        return (
            "SmartMedChart medication summary:\n"
            f"- Total schedules: {total}\n"
            f"- Given: {given}\n"
            f"- Upcoming: {upcoming}\n"
            f"- Delayed: {delayed}\n"
            f"- Held: {held}\n"
            f"- Refused: {refused}\n"
            f"- Not Given: {not_given}\n"
            f"- STAT schedules: {stat}\n"
            f"- Administration records: {administration_count}\n"
            f"- QR verification records: {qr_count}\n"
            f"- High delay-risk AI predictions: {high_delay_risk}\n"
            f"- High missed-dose-risk AI predictions: {high_missed_risk}"
        )

    return None


# =========================================================
# MAIN CHAT ENDPOINT
# =========================================================

@router.post(
    "",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    message = request.message.strip()

    if not message:
        return ChatResponse(
            answer="Please enter a question."
        )

    text = normalize_text(message)

    # 1. GREETING
    if text in {
        "hi",
        "hello",
        "hey",
        "hii",
        "good morning",
        "good afternoon",
        "good evening",
    }:
        return ChatResponse(
            answer=(
                "Hello! I am SmartMed Assistant. "
                "I can answer questions from the "
                "SmartMedChart database about patients, "
                "medicines, prescriptions, schedules, "
                "administration, QR verification, "
                "AI risk, safety, STAT medicines, "
                "and medication status."
            )
        )

    # 2. PATIENT-SPECIFIC QUESTIONS FIRST
    patient_answer = answer_patient_question(message)
    if patient_answer:
        return ChatResponse(answer=patient_answer)

    # 3. GENERAL DASHBOARD QUESTIONS
    dashboard_answer = answer_dashboard_question(message)
    if dashboard_answer:
        return ChatResponse(answer=dashboard_answer)

    # 4. SAFE FALLBACK
    return ChatResponse(
        answer=(
            "I can currently answer questions about "
            "patients, medicines, prescriptions, "
            "medication schedules, administration "
            "history, QR verification, AI risk, "
            "safety checks, STAT medicines, and "
            "medication status.\n\n"
            "Examples:\n"
            "- What medicines does PRADYUMNA KUNTHE have?\n"
            "- Show the medication schedule for PRADYUMNA KUNTHE\n"
            "- What is the administration history for PRADYUMNA KUNTHE?\n"
            "- Was the medication given?\n"
            "- What is the AI risk for PRADYUMNA KUNTHE?\n"
            "- Show QR verification history for PRADYUMNA KUNTHE\n"
            "- Is the medication safe?\n"
            "- How many delayed medicines are there?"
        )
    )