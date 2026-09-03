from datetime import date, datetime
import json
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AIPrediction,
    Allergy,
    MedicationAdministration,
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    QRVerification,
    User,
)
from app.security import require_permission


# Optional safety-service import.
# The chatbot will still run if the service module name differs.
try:
    from app.services.safety_service import check_medication_safety
except ImportError:
    try:
        from app.services.medication_safety_service import (
            check_medication_safety,
        )
    except ImportError:
        check_medication_safety = None


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
    if patient is None:
        return "Unknown patient"

    return (
        f"{patient.first_name} "
        f"{patient.last_name}"
    ).strip()


def format_date(value):
    if value is None:
        return "N/A"

    if isinstance(value, date):
        return value.strftime("%d %b %Y")

    return str(value)


def format_time(value):
    if value is None:
        return "N/A"

    if hasattr(value, "strftime"):
        return value.strftime("%I:%M %p")

    return str(value)


def format_datetime(value):
    if value is None:
        return "N/A"

    if isinstance(value, datetime):
        return value.strftime("%d %b %Y %I:%M %p")

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

def find_patient(db: Session, message: str):
    """
    Find an active patient.

    Matching priority:
    1. Exact patient ID
    2. Exact full name
    3. Exact first + last name tokens
    4. First name token
    5. Last name token

    Exact matches are checked first to avoid a generic
    first/last-name match selecting the wrong patient.
    """

    patients = db.scalars(
        select(Patient)
        .where(
            Patient.is_active.is_(True)
        )
        .order_by(
            Patient.last_name,
            Patient.first_name,
        )
    ).all()

    text = normalize_text(message)

    # -----------------------------------------------------
    # 1. Exact patient-code matches
    # -----------------------------------------------------

    for patient in patients:
        patient_code = normalize_text(
            patient.patient_id
        )

        if (
            patient_code
            and patient_code in text
        ):
            return patient

    # -----------------------------------------------------
    # 2. Exact full-name matches
    # -----------------------------------------------------

    for patient in patients:
        full_name = normalize_text(
            f"{patient.first_name} {patient.last_name}"
        )

        if (
            full_name
            and full_name in text
        ):
            return patient

    # -----------------------------------------------------
    # 3. Exact first + last tokens
    # -----------------------------------------------------

    for patient in patients:
        first_name = normalize_text(
            patient.first_name
        )
        last_name = normalize_text(
            patient.last_name
        )

        if not first_name or not last_name:
            continue

        first_match = re.search(
            rf"\b{re.escape(first_name)}\b",
            text,
        )

        last_match = re.search(
            rf"\b{re.escape(last_name)}\b",
            text,
        )

        if first_match and last_match:
            return patient

    # -----------------------------------------------------
    # 4. First name only
    # -----------------------------------------------------

    for patient in patients:
        first_name = normalize_text(
            patient.first_name
        )

        if (
            first_name
            and re.search(
                rf"\b{re.escape(first_name)}\b",
                text,
            )
        ):
            return patient

    # -----------------------------------------------------
    # 5. Last name only
    # -----------------------------------------------------

    for patient in patients:
        last_name = normalize_text(
            patient.last_name
        )

        if (
            last_name
            and re.search(
                rf"\b{re.escape(last_name)}\b",
                text,
            )
        ):
            return patient

    return None


# =========================================================
# PATIENT SUMMARY
# =========================================================

def build_patient_summary(
    db: Session,
    patient: Patient,
):
    allergies = db.scalars(
        select(Allergy)
        .where(
            Allergy.patient_id == patient.id
        )
    ).all()

    prescriptions = db.execute(
        select(
            PrescriptionItem,
            Medicine,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id == patient.id
        )
        .order_by(
            PrescriptionItem.id.desc()
        )
    ).all()

    lines = [
        f"Patient: {patient_name(patient)}",
        f"Patient ID: {patient.patient_id}",
        f"Date of birth: "
        f"{format_date(patient.date_of_birth)}",
        f"Gender: "
        f"{patient.gender or 'Not recorded'}",
        f"Weight: "
        f"{patient.weight_kg if patient.weight_kg is not None else 'Not recorded'} kg",
        f"Ward ID: "
        f"{patient.ward_id if patient.ward_id is not None else 'Not assigned'}",
        f"Bed ID: "
        f"{patient.bed_id if patient.bed_id is not None else 'Not assigned'}",
    ]

    if allergies:
        allergy_text = []

        for allergy in allergies:
            name = getattr(
                allergy,
                "allergen",
                None,
            ) or getattr(
                allergy,
                "allergy",
                None,
            ) or str(allergy)

            allergy_text.append(
                str(name)
            )

        lines.append(
            "Allergies: "
            + ", ".join(allergy_text)
        )

    else:
        lines.append(
            "Allergies: None recorded"
        )

    if prescriptions:
        lines.append("")
        lines.append(
            "Current / recorded medicines:"
        )

        for item, medicine in prescriptions:
            stat_text = (
                "STAT"
                if bool(item.is_stat)
                else "Routine"
            )

            lines.append(
                f"- {medicine.name}: "
                f"{item.dose or 'Dose not recorded'}, "
                f"{item.route or 'Route not recorded'}, "
                f"{item.frequency or 'Frequency not recorded'}, "
                f"{item.duration_days or 'Duration not recorded'} days, "
                f"{stat_text}"
            )

    else:
        lines.append(
            "Current medicines: None recorded"
        )

    return "\n".join(lines)


# =========================================================
# FIND PATIENT'S SCHEDULES
# =========================================================

def get_patient_schedule_rows(
    db: Session,
    patient_id: int,
):
    return db.execute(
        select(
            MedicationSchedule,
            PrescriptionItem,
            Medicine,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id == patient_id
        )
        .order_by(
            MedicationSchedule.scheduled_date,
            MedicationSchedule.scheduled_time,
        )
    ).all()


# =========================================================
# PATIENT MEDICATION SCHEDULE
# =========================================================

def answer_patient_schedule(
    db: Session,
    patient: Patient,
):
    rows = get_patient_schedule_rows(
        db,
        patient.id,
    )

    if not rows:
        return (
            f"No medication schedules were found "
            f"for {patient_name(patient)}."
        )

    lines = [
        f"Medication schedule for "
        f"{patient_name(patient)}:"
    ]

    for schedule, item, medicine in rows[:20]:
        stat_text = (
            " | STAT"
            if bool(item.is_stat)
            else ""
        )

        lines.append(
            f"- {medicine.name} | "
            f"{format_date(schedule.scheduled_date)} "
            f"{format_time(schedule.scheduled_time)} | "
            f"Status: {schedule.status} | "
            f"Dose: {item.dose or 'N/A'}"
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

def answer_patient_medicines(
    db: Session,
    patient: Patient,
):
    rows = db.execute(
        select(
            PrescriptionItem,
            Medicine,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id == patient.id
        )
        .order_by(
            PrescriptionItem.id.desc()
        )
    ).all()

    if not rows:
        return (
            f"No recorded medicines or prescriptions "
            f"were found for {patient_name(patient)}."
        )

    lines = [
        f"Medicines for "
        f"{patient_name(patient)}:"
    ]

    for item, medicine in rows:
        stat_text = (
            "STAT"
            if bool(item.is_stat)
            else "Routine"
        )

        lines.append(
            f"- {medicine.name} | "
            f"Dose: {item.dose or 'N/A'} | "
            f"Route: {item.route or 'N/A'} | "
            f"Frequency: {item.frequency or 'N/A'} | "
            f"Duration: {item.duration_days or 'N/A'} days | "
            f"{stat_text}"
        )

    return "\n".join(lines)


# =========================================================
# PATIENT ADMINISTRATION HISTORY
# =========================================================

def answer_patient_administration(
    db: Session,
    patient: Patient,
):
    rows = db.execute(
        select(
            MedicationAdministration,
            MedicationSchedule,
            PrescriptionItem,
            Medicine,
            User,
        )
        .join(
            MedicationSchedule,
            MedicationSchedule.id
            == MedicationAdministration.medication_schedule_id,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .join(
            User,
            User.id
            == MedicationAdministration.administered_by,
        )
        .where(
            Prescription.patient_id == patient.id
        )
        .order_by(
            MedicationAdministration.administered_at.desc()
        )
    ).all()

    if not rows:
        return (
            f"No medication administration records "
            f"were found for {patient_name(patient)}."
        )

    lines = [
        f"Medication administration history "
        f"for {patient_name(patient)}:"
    ]

    for (
        administration,
        schedule,
        item,
        medicine,
        user,
    ) in rows[:20]:
        username = (
            getattr(user, "username", None)
            or "Unknown staff"
        )

        lines.append(
            f"- {medicine.name} | "
            f"Status: {administration.status} | "
            f"Administered: "
            f"{format_datetime(administration.administered_at)} | "
            f"By: {username} | "
            f"Notes: {administration.notes or 'None'}"
        )

    if len(rows) > 20:
        lines.append(
            f"...and {len(rows) - 20} more administration records."
        )

    return "\n".join(lines)


# =========================================================
# PATIENT QR HISTORY
# =========================================================

def answer_patient_qr(
    db: Session,
    patient: Patient,
):
    rows = db.execute(
        select(
            QRVerification,
            MedicationSchedule,
            Medicine,
            User,
        )
        .outerjoin(
            MedicationSchedule,
            MedicationSchedule.id
            == QRVerification.medication_schedule_id,
        )
        .outerjoin(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .outerjoin(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            User,
            User.id
            == QRVerification.verified_by,
        )
        .where(
            QRVerification.patient_id == patient.id
        )
        .order_by(
            QRVerification.verified_at.desc()
        )
    ).all()

    if not rows:
        return (
            f"No QR verification records "
            f"were found for {patient_name(patient)}."
        )

    lines = [
        f"QR verification history "
        f"for {patient_name(patient)}:"
    ]

    for (
        verification,
        schedule,
        medicine,
        user,
    ) in rows[:20]:
        username = (
            getattr(user, "username", None)
            or "Unknown staff"
        )

        medicine_name = (
            medicine.name
            if medicine is not None
            else "Patient QR only"
        )

        medication_valid = (
            "Not checked"
            if verification.medication_valid is None
            else (
                "Valid"
                if verification.medication_valid
                else "Invalid"
            )
        )

        lines.append(
            f"- {format_datetime(verification.verified_at)} | "
            f"Patient QR: "
            f"{'Valid' if verification.patient_qr_valid else 'Invalid'} | "
            f"Medication: {medicine_name} | "
            f"Medication check: {medication_valid} | "
            f"Result: {verification.result} | "
            f"By: {username}"
        )

        if verification.message:
            lines.append(
                f"  Message: {verification.message}"
            )

    return "\n".join(lines)


# =========================================================
# PATIENT AI RISK
# =========================================================

def answer_patient_ai(
    db: Session,
    patient: Patient,
):
    rows = db.execute(
        select(
            AIPrediction,
            MedicationSchedule,
            PrescriptionItem,
            Medicine,
        )
        .join(
            MedicationSchedule,
            MedicationSchedule.id
            == AIPrediction.medication_schedule_id,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id == patient.id
        )
        .order_by(
            AIPrediction.created_at.desc()
        )
    ).all()

    if not rows:
        return (
            f"No AI risk predictions were found "
            f"for {patient_name(patient)}."
        )

    lines = [
        f"AI medication risk for "
        f"{patient_name(patient)}:"
    ]

    for (
        prediction,
        schedule,
        item,
        medicine,
    ) in rows[:20]:
        delay_percent = (
            round(
                prediction.delay_probability * 100,
                1,
            )
        )

        missed_percent = (
            round(
                prediction.missed_probability * 100,
                1,
            )
        )

        lines.append(
            f"- {medicine.name} | "
            f"Scheduled: "
            f"{format_date(schedule.scheduled_date)} "
            f"{format_time(schedule.scheduled_time)} | "
            f"Delay risk: "
            f"{prediction.delay_risk_level} "
            f"({delay_percent}%) | "
            f"Missed risk: "
            f"{prediction.missed_risk_level} "
            f"({missed_percent}%)"
        )

        delay_reasons = parse_json_list(
            prediction.delay_reasons
        )

        missed_reasons = parse_json_list(
            prediction.missed_reasons
        )

        if delay_reasons:
            lines.append(
                "  Delay reasons: "
                + ", ".join(
                    str(reason)
                    for reason in delay_reasons[:5]
                )
            )

        if missed_reasons:
            lines.append(
                "  Missed-dose reasons: "
                + ", ".join(
                    str(reason)
                    for reason in missed_reasons[:5]
                )
            )

    return "\n".join(lines)


# =========================================================
# PATIENT SAFETY
# =========================================================

def answer_patient_safety(
    db: Session,
    patient: Patient,
):
    schedules = get_patient_schedule_rows(
        db,
        patient.id,
    )

    if not schedules:
        return (
            f"No medication schedules were found "
            f"for {patient_name(patient)}, so there are "
            f"no schedule-specific safety checks to show."
        )

    if check_medication_safety is None:
        return (
            "The safety engine is available in SmartMedChart, "
            "but the chatbot could not load its service module."
        )

    lines = [
        f"Medication safety for "
        f"{patient_name(patient)}:"
    ]

    found_any = False

    for (
        schedule,
        item,
        medicine,
    ) in schedules:
        try:
            result = check_medication_safety(
                db=db,
                schedule_id=schedule.id,
            )
        except Exception as error:
            lines.append(
                f"- {medicine.name} | "
                f"Safety check unavailable for schedule "
                f"{schedule.id}: {error}"
            )
            continue

        found_any = True

        safe = bool(
            result.get("safe")
            if isinstance(result, dict)
            else getattr(result, "safe", False)
        )

        severity = (
            result.get("severity")
            if isinstance(result, dict)
            else getattr(result, "severity", "UNKNOWN")
        )

        message = (
            result.get("message")
            if isinstance(result, dict)
            else getattr(result, "message", "")
        )

        warnings = (
            result.get("warnings", [])
            if isinstance(result, dict)
            else getattr(result, "warnings", [])
        )

        status_text = (
            "SAFE"
            if safe
            else "WARNING"
        )

        lines.append(
            f"- {medicine.name} | "
            f"Schedule {schedule.id} | "
            f"{status_text} | Severity: {severity}"
        )

        if message:
            lines.append(
                f"  Message: {message}"
            )

        if warnings:
            for warning in warnings[:5]:
                if isinstance(warning, dict):
                    warning_message = warning.get(
                        "message",
                        "",
                    )
                    reason = warning.get(
                        "reason",
                        "",
                    )
                    warning_severity = warning.get(
                        "severity",
                        "",
                    )
                else:
                    warning_message = getattr(
                        warning,
                        "message",
                        "",
                    )
                    reason = getattr(
                        warning,
                        "reason",
                        "",
                    )
                    warning_severity = getattr(
                        warning,
                        "severity",
                        "",
                    )

                lines.append(
                    f"  Warning [{warning_severity}]: "
                    f"{warning_message}"
                )

                if reason:
                    lines.append(
                        f"  Reason: {reason}"
                    )

    if not found_any:
        return (
            f"No completed safety results were available "
            f"for {patient_name(patient)}."
        )

    return "\n".join(lines)


# =========================================================
# PATIENT-SPECIFIC QUESTIONS
# =========================================================

def answer_patient_question(
    db: Session,
    message: str,
):
    patient = find_patient(
        db,
        message,
    )

    if patient is None:
        return None

    text = normalize_text(message)

    # -----------------------------------------------------
    # ADMINISTRATION
    # -----------------------------------------------------

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

    if any(
        keyword in text
        for keyword in administration_keywords
    ):
        return answer_patient_administration(
            db,
            patient,
        )

    # -----------------------------------------------------
    # QR VERIFICATION
    # -----------------------------------------------------

    qr_keywords = [
        "qr",
        "verification",
        "verified",
        "scan",
        "scanned",
        "patient qr",
        "medication qr",
    ]

    if any(
        keyword in text
        for keyword in qr_keywords
    ):
        return answer_patient_qr(
            db,
            patient,
        )

    # -----------------------------------------------------
    # AI RISK
    # -----------------------------------------------------

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

    if any(
        keyword in text
        for keyword in ai_keywords
    ):
        return answer_patient_ai(
            db,
            patient,
        )

    # -----------------------------------------------------
    # SAFETY
    # -----------------------------------------------------

    safety_keywords = [
        "safety",
        "safe",
        "warning",
        "warnings",
        "allergy warning",
        "medication safety",
        "drug safety",
    ]

    if any(
        keyword in text
        for keyword in safety_keywords
    ):
        return answer_patient_safety(
            db,
            patient,
        )

    # -----------------------------------------------------
    # BASIC PATIENT INFORMATION
    # -----------------------------------------------------

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

    if any(
        word in text
        for word in basic_keywords
    ):
        return build_patient_summary(
            db,
            patient,
        )

    # -----------------------------------------------------
    # MEDICATION SCHEDULE
    # IMPORTANT: BEFORE MEDICINE/PRESCRIPTION
    # -----------------------------------------------------

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

    if any(
        word in text
        for word in schedule_keywords
    ):
        return answer_patient_schedule(
            db,
            patient,
        )

    # -----------------------------------------------------
    # MEDICINES / PRESCRIPTIONS
    # -----------------------------------------------------

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

    if any(
        word in text
        for word in medicine_keywords
    ):
        return answer_patient_medicines(
            db,
            patient,
        )

    return build_patient_summary(
        db,
        patient,
    )


# =========================================================
# GENERAL DASHBOARD QUESTIONS
# =========================================================

def answer_dashboard_question(
    db: Session,
    message: str,
):
    text = normalize_text(message)

    total = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        )
    ) or 0

    given = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "GIVEN"
        )
    ) or 0

    upcoming = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "UPCOMING"
        )
    ) or 0

    delayed = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "DELAYED"
        )
    ) or 0

    held = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "HELD"
        )
    ) or 0

    refused = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "REFUSED"
        )
    ) or 0

    not_given = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            MedicationSchedule.status == "NOT_GIVEN"
        )
    ) or 0

    stat = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .where(
            PrescriptionItem.is_stat.is_(True)
        )
    ) or 0

    administration_count = db.scalar(
        select(
            func.count(
                MedicationAdministration.id
            )
        )
    ) or 0

    qr_count = db.scalar(
        select(
            func.count(
                QRVerification.id
            )
        )
    ) or 0

    high_delay_risk = db.scalar(
        select(
            func.count(
                AIPrediction.id
            )
        ).where(
            AIPrediction.delay_risk_level.in_(
                ["HIGH", "CRITICAL"]
            )
        )
    ) or 0

    high_missed_risk = db.scalar(
        select(
            func.count(
                AIPrediction.id
            )
        ).where(
            AIPrediction.missed_risk_level.in_(
                ["HIGH", "CRITICAL"]
            )
        )
    ) or 0

    # -----------------------------------------------------
    # ADMINISTRATION COUNTS
    # -----------------------------------------------------

    if (
        "administration" in text
        or "administered" in text
    ):
        return (
            "SmartMedChart administration summary:\n"
            f"- Administration records: "
            f"{administration_count}\n"
            f"- GIVEN schedules: {given}\n"
            f"- DELAYED schedules: {delayed}\n"
            f"- HELD schedules: {held}\n"
            f"- REFUSED schedules: {refused}\n"
            f"- NOT GIVEN schedules: {not_given}"
        )

    # -----------------------------------------------------
    # QR COUNTS
    # -----------------------------------------------------

    if (
        "qr" in text
        or "verification" in text
    ):
        return (
            f"SmartMedChart has "
            f"{qr_count} QR verification records."
        )

    # -----------------------------------------------------
    # AI RISK COUNTS
    # -----------------------------------------------------

    if (
        "ai risk" in text
        or "high risk" in text
        or "risk" in text
    ):
        return (
            "SmartMedChart AI risk summary:\n"
            f"- High delay-risk predictions: "
            f"{high_delay_risk}\n"
            f"- High missed-dose-risk predictions: "
            f"{high_missed_risk}"
        )

    # -----------------------------------------------------
    # STATUS COUNTS
    # -----------------------------------------------------

    if "stat" in text:
        return (
            f"There are {stat} STAT medication "
            f"schedule entries in SmartMedChart."
        )

    if "delayed" in text:
        return (
            f"There are {delayed} delayed medication "
            f"schedule entries."
        )

    if "given" in text:
        return (
            f"There are {given} medication schedule "
            f"entries marked as GIVEN."
        )

    if (
        "upcoming" in text
        or "pending" in text
    ):
        return (
            f"There are {upcoming} upcoming medication "
            f"schedule entries."
        )

    if "held" in text:
        return (
            f"There are {held} medication schedule "
            f"entries marked as HELD."
        )

    if "refused" in text:
        return (
            f"There are {refused} medication schedule "
            f"entries marked as REFUSED."
        )

    if (
        "not given" in text
        or "not_given" in text
    ):
        return (
            f"There are {not_given} medication schedule "
            f"entries marked as NOT GIVEN."
        )

    # -----------------------------------------------------
    # FULL DASHBOARD SUMMARY
    # -----------------------------------------------------

    if any(
        word in text
        for word in [
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
            f"- Administration records: "
            f"{administration_count}\n"
            f"- QR verification records: "
            f"{qr_count}\n"
            f"- High delay-risk AI predictions: "
            f"{high_delay_risk}\n"
            f"- High missed-dose-risk AI predictions: "
            f"{high_missed_risk}"
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
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    message = request.message.strip()

    if not message:
        return ChatResponse(
            answer="Please enter a question."
        )

    text = normalize_text(message)

    # -----------------------------------------------------
    # GREETING
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # PATIENT-SPECIFIC QUESTIONS FIRST
    # -----------------------------------------------------

    patient_answer = answer_patient_question(
        db,
        message,
    )

    if patient_answer:
        return ChatResponse(
            answer=patient_answer
        )

    # -----------------------------------------------------
    # GENERAL DASHBOARD QUESTIONS
    # -----------------------------------------------------

    dashboard_answer = answer_dashboard_question(
        db,
        message,
    )

    if dashboard_answer:
        return ChatResponse(
            answer=dashboard_answer
        )

    # -----------------------------------------------------
    # SAFE FALLBACK
    # -----------------------------------------------------

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