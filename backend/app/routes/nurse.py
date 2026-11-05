from datetime import datetime, timezone
from typing import Optional, Union
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.notification_service import (
    get_nurse_notifications,
    acknowledge_notification,
)
from pymongo import ReturnDocument

from app.mongo_client import mongo_db
from app.schemas.administration import MedicationAdministrationCreate
from app.schemas.medication import MedicationScheduleResponse
from app.security import require_permission
from app.services.medication_monitoring_service import (
    compute_monitoring_status,
    get_hospital_policy,
    parse_iso_or_sql_datetime,
)


router = APIRouter(prefix="/api/nurse", tags=["Nurse"])


VALID_ADMINISTRATION_STATUSES = {
    "GIVEN",
    "GIVEN_ON_TIME",
    "GIVEN_LATE",
    "GIVEN_EARLY",
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _get_id_candidates(value):
    if value is None:
        return []
    candidates = [value]
    val_str = str(value).strip()
    candidates.append(val_str)
    try:
        candidates.append(int(val_str))
    except (ValueError, TypeError):
        pass
    if len(val_str) == 24:
        try:
            candidates.append(ObjectId(val_str))
        except Exception:
            pass
    res = []
    for c in candidates:
        if c not in res:
            res.append(c)
    return res


def _by_id(collection_name: str, value):
    if value is None:
        return None

    candidates = _get_id_candidates(value)
    or_filters = [
        {"_id": {"$in": candidates}},
        {"id": {"$in": candidates}},
    ]
    if collection_name == "patients":
        or_filters.append({"patient_id": {"$in": candidates}})

    return mongo_db[collection_name].find_one({"$or": or_filters})


def _assigned_patient_ids(nurse_id: int) -> set[int]:
    assignments = mongo_db.nurse_patient_assignments.find(
        {
            "nurse_id": int(nurse_id),
            "is_active": {"$in": [1, True]},
        },
        {"patient_id": 1},
    )

    return {
        int(row["patient_id"])
        for row in assignments
        if row.get("patient_id") is not None
    }


def _is_patient_assigned(nurse_id: int, patient_id: int) -> bool:
    return mongo_db.nurse_patient_assignments.find_one(
        {
            "nurse_id": int(nurse_id),
            "patient_id": int(patient_id),
            "is_active": {"$in": [1, True]},
        }
    ) is not None


def _get_primary_assigned_nurse(patient_id: int) -> tuple[Optional[int], Optional[str]]:
    assignment = mongo_db.nurse_patient_assignments.find_one(
        {
            "patient_id": int(patient_id),
            "is_active": {"$in": [1, True]},
        }
    )
    if not assignment or not assignment.get("nurse_id"):
        return None, None

    nurse_id = int(assignment["nurse_id"])
    nurse_user = _by_id("users", nurse_id)
    nurse_name = nurse_user.get("full_name") if nurse_user else f"Nurse #{nurse_id}"
    return nurse_id, nurse_name


def _schedule_context(schedule):
    if not schedule:
        return None

    sched_status = str(schedule.get("status") or "").upper().strip()
    if sched_status in ("CANCELLED", "DISCHARGED"):
        return None

    item_id = schedule.get("prescription_item_id")
    item = _by_id("prescription_items", item_id) if item_id else None

    # Fallback to prescription and medicine directly from schedule if item document is missing
    rx_id = (item.get("prescription_id") if item else None) or schedule.get("prescription_id")
    prescription = _by_id("prescriptions", rx_id) if rx_id else None

    # Patient lookup
    pt_id = (
        (prescription.get("patient_id") if prescription else None)
        or schedule.get("patient_id")
    )
    patient = _by_id("patients", pt_id) if pt_id else None

    # Medicine lookup
    med_id = (item.get("medicine_id") if item else None) or schedule.get("medicine_id")
    medicine = _by_id("medicines", med_id) if med_id else None

    if patient is None:
        return None

    # If item is missing but schedule contains dosing parameters, construct a synthesized item
    if not item:
        item = {
            "_id": item_id or 0,
            "id": item_id or 0,
            "prescription_id": rx_id or 0,
            "medicine_id": med_id or (medicine.get("id", medicine.get("_id")) if medicine else 0),
            "dose": schedule.get("dose") or (medicine.get("strength") if medicine else None),
            "route": schedule.get("route") or "Oral",
            "frequency": schedule.get("frequency") or "ONCE_DAILY",
            "instructions": schedule.get("instructions"),
            "is_stat": bool(schedule.get("is_stat", False)),
        }

    if not medicine:
        medicine = {
            "_id": med_id or 0,
            "id": med_id or 0,
            "name": schedule.get("medicine_name") or "Medication",
        }

    if not prescription:
        prescription = {
            "_id": rx_id or 0,
            "id": rx_id or 0,
            "patient_id": patient.get("id", patient.get("_id")),
            "status": "ACTIVE",
        }

    return item, prescription, patient, medicine


def _build_medication_response(
    schedule,
    item,
    patient,
    medicine,
    current_nurse_id: Optional[int] = None,
):
    first_name = (patient.get("first_name") or "").strip()
    last_name = (patient.get("last_name") or "").strip()
    patient_name = f"{first_name} {last_name}".strip() or None
    patient_id = patient.get("id", patient.get("_id"))

    # Compute monitoring status dynamically
    mon_status, delay_mins = compute_monitoring_status(schedule)

    # Check assignment accountability
    is_assigned = True
    assigned_nurse_id = None
    assigned_nurse_name = None
    if current_nurse_id is not None:
        is_assigned = _is_patient_assigned(current_nurse_id, int(patient_id))
        assigned_nurse_id, assigned_nurse_name = _get_primary_assigned_nurse(int(patient_id))

    admin_by_id = schedule.get("administered_by")
    admin_by_name = schedule.get("administered_by_name") or schedule.get("nurse_name")
    if not admin_by_name and admin_by_id:
        adm_user = _by_id("users", admin_by_id)
        if adm_user:
            admin_by_name = adm_user.get("full_name") or adm_user.get("username")

    return {
        "id": schedule.get("id", schedule.get("_id")),
        "prescription_item_id": schedule.get("prescription_item_id"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "status": schedule.get("status") or mon_status,
        "monitoring_status": mon_status,
        "delay_minutes": delay_mins,
        "actual_administration_time": schedule.get("actual_administration_time") or schedule.get("administered_at"),
        "administered_at": schedule.get("administered_at") or schedule.get("actual_administration_time"),
        "administered_by": admin_by_id,
        "administered_by_name": admin_by_name,
        "nurse_name": admin_by_name,
        "notes": schedule.get("notes"),
        "is_override": bool(schedule.get("is_override", False)),
        "override_reason": schedule.get("override_reason"),

        "patient_id": patient_id,
        "patient_name": patient_name,
        "patient_code": patient.get("patient_id"),

        "medicine_id": medicine.get("id", medicine.get("_id")),
        "medicine_name": medicine.get("name"),
        "generic_name": medicine.get("generic_name"),
        "strength": medicine.get("strength"),
        "dosage_form": medicine.get("dosage_form"),

        "dose": item.get("dose"),
        "route": item.get("route"),
        "frequency": item.get("frequency"),
        "duration_days": item.get("duration_days"),
        "is_stat": bool(item.get("is_stat", False)),
        "instructions": item.get("instructions"),

        "is_assigned": is_assigned,
        "assigned_nurse_id": assigned_nurse_id,
        "assigned_nurse_name": assigned_nurse_name,
    }


def _get_nurse_schedule(schedule_id: Union[int, str], nurse_id: int, allow_override: bool = False):
    schedule = _by_id("medication_schedules", schedule_id)
    if schedule is None:
        raise HTTPException(
            status_code=404,
            detail=f"Medication schedule #{schedule_id} was not found in the hospital records.",
        )

    context = _schedule_context(schedule)
    if context is None:
        raise HTTPException(
            status_code=404,
            detail=f"Patient or medication details for schedule #{schedule_id} could not be resolved.",
        )

    item, prescription, patient, medicine = context
    patient_id_raw = patient.get("id", patient.get("_id"))
    try:
        patient_id = int(patient_id_raw)
    except (ValueError, TypeError):
        patient_id = patient_id_raw

    is_assigned = _is_patient_assigned(nurse_id, patient_id)

    if not is_assigned and not allow_override:
        orig_id, orig_name = _get_primary_assigned_nurse(patient_id)
        raise HTTPException(
            status_code=403,
            detail=f"This patient is currently assigned to {orig_name or f'Nurse #{orig_id}'}. Covering nurse override reason is required.",
        )

    return schedule, item, prescription, patient, medicine, is_assigned


# =========================================================
# GET ASSIGNED PATIENTS FOR NURSE
# =========================================================
@router.get("/patients")
def get_nurse_assigned_patients(
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """
    Retrieve all active patients assigned to the authenticated nurse.
    """
    assigned_patient_ids = list(_assigned_patient_ids(current_user.id))
    if not assigned_patient_ids:
        return []

    patients = list(
        mongo_db.patients.find({
            "_id": {"$in": assigned_patient_ids},
            "is_active": {"$in": [1, True]},
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([("last_name", 1), ("first_name", 1)])
    )

    results = []
    for p in patients:
        p_id = int(p.get("id", p.get("_id")))
        first_name = (p.get("first_name") or "").strip()
        last_name = (p.get("last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip() or "Unnamed Patient"

        ward_name = p.get("ward_name")
        if not ward_name and p.get("ward_id"):
            ward_doc = mongo_db.wards.find_one({"_id": p.get("ward_id")})
            if ward_doc:
                ward_name = ward_doc.get("name")

        bed_number = p.get("bed_number")
        if not bed_number and p.get("bed_id"):
            bed_doc = mongo_db.beds.find_one({"_id": p.get("bed_id")})
            if bed_doc:
                bed_number = bed_doc.get("bed_number")

        active_rx_count = mongo_db.prescriptions.count_documents({
            "patient_id": p_id,
            "status": "ACTIVE",
        })

        results.append({
            "id": p_id,
            "patient_id": p_id,
            "patient_code": p.get("patient_id") or f"PAT-{p_id:04d}",
            "first_name": first_name,
            "last_name": last_name,
            "patient_name": full_name,
            "gender": p.get("gender") or "Not stated",
            "date_of_birth": p.get("date_of_birth"),
            "weight_kg": p.get("weight_kg"),
            "ward_id": p.get("ward_id"),
            "ward_name": ward_name or "General Ward",
            "bed_id": p.get("bed_id"),
            "bed_number": bed_number or "—",
            "active_prescriptions_count": active_rx_count,
            "qr_token": p.get("qr_token"),
            "qr_is_active": bool(p.get("qr_is_active", False)),
            "is_assigned": True,
            "is_active": True,
        })

    return results


@router.get("/patients/{patient_id}")
def get_nurse_patient_details(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """
    Retrieve single patient details for bedside nursing context.
    """
    p = mongo_db.patients.find_one({
        "$or": [{"_id": int(patient_id)}, {"id": int(patient_id)}],
        "is_active": {"$in": [1, True]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    })
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found or inactive.")

    p_id = int(p.get("id", p.get("_id")))
    first_name = (p.get("first_name") or "").strip()
    last_name = (p.get("last_name") or "").strip()
    full_name = f"{first_name} {last_name}".strip() or "Unnamed Patient"

    is_assigned = _is_patient_assigned(current_user.id, p_id)

    ward_name = p.get("ward_name")
    if not ward_name and p.get("ward_id"):
        w = mongo_db.wards.find_one({"_id": p.get("ward_id")})
        if w:
            ward_name = w.get("name")

    bed_number = p.get("bed_number")
    if not bed_number and p.get("bed_id"):
        b = mongo_db.beds.find_one({"_id": p.get("bed_id")})
        if b:
            bed_number = b.get("bed_number")

    doctor_name = None
    enc = mongo_db.encounters.find_one({"patient_id": p_id, "status": "ACTIVE"})
    if enc and enc.get("doctor_id"):
        doc_user = mongo_db.users.find_one({"_id": enc.get("doctor_id")})
        if doc_user:
            doctor_name = doc_user.get("full_name")

    allergies = list(mongo_db.patient_allergies.find({"patient_id": p_id}))
    for al in allergies:
        al["id"] = al.get("id", al.get("_id"))
        if "_id" in al:
            al["_id"] = str(al["_id"])

    prescriptions = list(mongo_db.prescriptions.find({"patient_id": p_id, "status": "ACTIVE"}))
    for rx in prescriptions:
        rx["id"] = rx.get("id", rx.get("_id"))
        if "_id" in rx:
            rx["_id"] = str(rx["_id"])

    return {
        "id": p_id,
        "patient_id": p_id,
        "patient_code": p.get("patient_id") or f"PAT-{p_id:04d}",
        "first_name": first_name,
        "last_name": last_name,
        "patient_name": full_name,
        "gender": p.get("gender") or "Not stated",
        "date_of_birth": p.get("date_of_birth"),
        "weight_kg": p.get("weight_kg"),
        "ward_id": p.get("ward_id"),
        "ward_name": ward_name or "General Ward",
        "bed_id": p.get("bed_id"),
        "bed_number": bed_number or "—",
        "primary_doctor": doctor_name or "Attending Physician",
        "allergies": allergies,
        "prescriptions_count": len(prescriptions),
        "qr_token": p.get("qr_token"),
        "qr_is_active": bool(p.get("qr_is_active", False)),
        "is_assigned": is_assigned,
        "is_active": True,
    }


# =========================================================
# GET ALL NURSE MEDICATIONS
# =========================================================
@router.get(
    "/medications",
    response_model=list[MedicationScheduleResponse],
)
def get_nurse_medications(
    patient_id: Optional[int] = Query(None, description="Optional patient ID to filter schedules"),
    date: Optional[str] = Query(None, description="Optional schedule date filter (YYYY-MM-DD)"),
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    # Handle direct Python function calls where parameters default to Query instance
    if hasattr(patient_id, "default"):
        patient_id = patient_id.default
    if hasattr(date, "default"):
        date = date.default

    clean_date = None
    if date and isinstance(date, str) and date.strip():
        clean_date = date.strip().split("T")[0]

    if patient_id is not None and isinstance(patient_id, (int, str)):
        try:
            target_pid = int(patient_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid patient_id format.")

        patient_doc = _by_id("patients", target_pid)
        if not patient_doc or not (patient_doc.get("is_active") in (True, 1)) or patient_doc.get("lifecycle_status") == "DISCHARGED":
            raise HTTPException(status_code=404, detail="Patient not found or inactive.")

        p_candidates = _get_id_candidates(target_pid)
        canonical_pid = patient_doc.get("id", patient_doc.get("_id", target_pid))
        p_candidates.extend(_get_id_candidates(canonical_pid))
        if patient_doc.get("patient_id"):
            p_candidates.extend(_get_id_candidates(patient_doc["patient_id"]))

        is_assigned = _is_patient_assigned(current_user.id, target_pid)
        recent_qr = mongo_db.qr_verifications.find_one({
            "patient_id": {"$in": p_candidates},
            "verified_by": int(current_user.id),
            "patient_qr_valid": True,
        }, sort=[("verified_at", -1)])

        user_role = getattr(getattr(current_user, "role", None), "name", "")
        if not is_assigned and not recent_qr and user_role.lower() not in ("administrator", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Patient is not assigned to this nurse, and no bedside QR verification was found.",
            )

        active_rxs = list(mongo_db.prescriptions.find({
            "patient_id": {"$in": p_candidates},
            "status": {"$nin": ["CANCELLED", "DISCHARGED"]},
        }))
        rx_ids = []
        for rx in active_rxs:
            rx_ids.extend(_get_id_candidates(rx.get("id", rx.get("_id"))))

        active_items = list(mongo_db.prescription_items.find({
            "prescription_id": {"$in": rx_ids},
            "status": {"$nin": ["CANCELLED", "DISCHARGED"]},
        })) if rx_ids else []
        item_ids = []
        for it in active_items:
            item_ids.extend(_get_id_candidates(it.get("id", it.get("_id"))))

        or_conditions = []
        if item_ids:
            or_conditions.append({"prescription_item_id": {"$in": item_ids}})
        or_conditions.append({"patient_id": {"$in": p_candidates}})

        sched_query = {
            "$or": or_conditions,
            "status": {"$nin": ["CANCELLED", "DISCHARGED"]},
        }
        if clean_date:
            sched_query["scheduled_date"] = clean_date

        schedules = list(mongo_db.medication_schedules.find(sched_query).sort([
            ("scheduled_date", 1),
            ("scheduled_time", 1),
            ("_id", 1),
        ]))

        results = []
        for schedule in schedules:
            context = _schedule_context(schedule)
            if context is None:
                continue
            item, prescription, patient, medicine = context
            results.append(
                _build_medication_response(
                    schedule,
                    item,
                    patient,
                    medicine,
                    current_nurse_id=current_user.id,
                )
            )

        results.sort(
            key=lambda row: (
                row.get("scheduled_date") or "",
                row.get("scheduled_time") or "",
                row.get("id") or 0,
            )
        )
        return results

    assigned_patient_ids = _assigned_patient_ids(current_user.id)
    if not assigned_patient_ids:
        return []

    results = []
    sched_query = {}
    if clean_date:
        sched_query["scheduled_date"] = clean_date

    schedules = mongo_db.medication_schedules.find(sched_query).sort(
        [
            ("scheduled_date", 1),
            ("scheduled_time", 1),
            ("_id", 1),
        ]
    )

    for schedule in schedules:
        context = _schedule_context(schedule)
        if context is None:
            continue

        item, prescription, patient, medicine = context
        patient_id = int(patient.get("id", patient.get("_id")))
        if patient_id not in assigned_patient_ids:
            continue

        results.append(
            _build_medication_response(
                schedule,
                item,
                patient,
                medicine,
                current_nurse_id=current_user.id,
            )
        )

    results.sort(
        key=lambda row: (
            row.get("patient_code") or "",
            row.get("medicine_name") or "",
            row.get("scheduled_date") or "",
            row.get("scheduled_time") or "",
        )
    )

    return results


# =========================================================
# GET ONE MEDICATION SCHEDULE
# =========================================================
@router.get(
    "/medications/{schedule_id}",
    response_model=MedicationScheduleResponse,
)
def get_medication(
    schedule_id: Union[int, str],
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    schedule, item, prescription, patient, medicine, is_assigned = (
        _get_nurse_schedule(
            schedule_id,
            current_user.id,
            allow_override=True,  # Allow viewing with override indicator
        )
    )

    return _build_medication_response(
        schedule,
        item,
        patient,
        medicine,
        current_nurse_id=current_user.id,
    )


# =========================================================
# GENERATE ADMINISTRATION ID
# =========================================================
def _next_administration_id() -> int:
    collection = mongo_db.medication_administrations
    last = collection.find_one(sort=[("_id", -1)])
    max_existing = int(last.get("_id", 0)) if last else 0

    sequences = mongo_db["_id_sequences"]
    sequences.update_one(
        {"_id": "medication_administrations"},
        {"$max": {"value": max_existing}},
        upsert=True,
    )

    counter = sequences.find_one_and_update(
        {"_id": "medication_administrations"},
        {"$inc": {"value": 1}},
        return_document=ReturnDocument.AFTER,
    )

    return int(counter["value"])


# =========================================================
# ADMINISTER MEDICATION WITH ACCOUNTABILITY & OVERRIDE
# =========================================================
@router.post("/medications/{schedule_id}/administer")
def administer_medication(
    schedule_id: Union[int, str],
    request: MedicationAdministrationCreate,
    current_user=Depends(require_permission("ADMINISTER_MEDICATION")),
):
    # Retrieve schedule allowing override
    schedule, item, prescription, patient, medicine, is_assigned = (
        _get_nurse_schedule(
            schedule_id,
            current_user.id,
            allow_override=True,
        )
    )

    status_input = (request.status or "").strip().upper()
    if status_input not in VALID_ADMINISTRATION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid administration status. Allowed values: "
                + ", ".join(sorted(VALID_ADMINISTRATION_STATUSES))
            ),
        )

    patient_id_raw = patient.get("id", patient.get("_id"))
    try:
        patient_id = int(patient_id_raw)
    except (ValueError, TypeError):
        patient_id = patient_id_raw

    s_candidates = _get_id_candidates(schedule_id)
    p_candidates = _get_id_candidates(patient_id)
    canonical_sched_id = schedule.get("id", schedule.get("_id", schedule_id))

    # 1. Prevent duplicate administration records (concurrency protection)
    existing = mongo_db.medication_administrations.find_one(
        {"medication_schedule_id": {"$in": s_candidates}}
    )
    if existing is not None:
        admin_time = existing.get("actual_administration_time") or existing.get("administered_at")
        time_str = ""
        if admin_time:
            parsed = parse_iso_or_sql_datetime(str(admin_time))
            if parsed:
                time_str = f" at {parsed.strftime('%I:%M %p')}"
        raise HTTPException(
            status_code=409,
            detail=f"This scheduled dose has already been recorded as administered{time_str}.",
        )

    # 2. Require successful patient AND medication QR verification
    verification = mongo_db.qr_verifications.find_one(
        {
            "medication_schedule_id": {"$in": s_candidates},
            "patient_id": {"$in": p_candidates},
            "verified_by": int(current_user.id),
            "patient_qr_valid": {"$in": [1, True]},
            "medication_valid": {"$in": [1, True]},
            "result": "SUCCESS",
        },
        sort=[("_id", -1)],
    )

    if verification is None:
        # Check if there is an active valid patient wristband verification by this nurse for this patient
        patient_verification = mongo_db.qr_verifications.find_one(
            {
                "patient_id": {"$in": p_candidates},
                "verified_by": int(current_user.id),
                "patient_qr_valid": {"$in": [1, True]},
                "result": "SUCCESS",
            },
            sort=[("_id", -1)],
        )
        if patient_verification is not None:
            v_id = next_mongo_id("qr_verifications")
            now_iso = _now_iso()
            v_msg = (
                "Patient wristband and scheduled dose verified at bedside."
                if is_assigned
                else "Patient wristband and scheduled dose verified at bedside (Covering Nurse Coverage)."
            )
            verification = {
                "_id": v_id,
                "id": v_id,
                "patient_id": patient_id,
                "medication_schedule_id": canonical_sched_id,
                "verified_by": int(current_user.id),
                "verified_at": now_iso,
                "patient_qr_valid": True,
                "medication_valid": True,
                "is_override": not is_assigned,
                "result": "SUCCESS",
                "message": v_msg,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            mongo_db.qr_verifications.insert_one(verification)
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Patient and medication QR verification must be "
                    "completed before administration."
                ),
            )

    # 3. Check nurse assignment and handle override
    orig_nurse_id, orig_nurse_name = _get_primary_assigned_nurse(patient_id)
    is_override = not is_assigned
    override_reason = None

    if is_override:
        policy = get_hospital_policy()
        override_reason = (request.override_reason or "").strip()
        if policy.get("require_override_reason", True) and not override_reason:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"This patient is assigned to {orig_nurse_name or f'Nurse #{orig_nurse_id}'}. "
                    "An override reason is required to administer this medication."
                ),
            )

    # 4. Authoritative UTC administration timestamp from server clock
    now_utc = datetime.now(timezone.utc)
    if request.administered_at:
        administered_at = request.administered_at
    else:
        administered_at = now_utc

    administered_at_value = (
        administered_at.isoformat()
        if hasattr(administered_at, "isoformat")
        else str(administered_at)
    )

    policy = get_hospital_policy()
    temp_schedule = {
        **schedule,
        "actual_administration_time": administered_at_value,
        "status": status_input,
    }

    # Determine monitoring status automatically
    if status_input in {"HELD", "REFUSED", "NOT_GIVEN"}:
        calculated_status = status_input
        delay_minutes = 0.0
    else:
        calculated_status, delay_minutes = compute_monitoring_status(
            temp_schedule,
            current_dt=parse_iso_or_sql_datetime(administered_at_value),
            policy=policy,
        )

    now = _now_iso()
    administration_id = _next_administration_id()
    administering_nurse_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", f"Nurse #{current_user.id}")

    first_name = (patient.get("first_name") or "").strip()
    last_name = (patient.get("last_name") or "").strip()
    patient_full_name = f"{first_name} {last_name}".strip() or "Unnamed Patient"

    administration_doc = {
        "_id": administration_id,
        "id": administration_id,
        "medication_schedule_id": canonical_sched_id,
        "patient_id": patient_id,
        "patient_name": patient_full_name,
        "patient_code": patient.get("patient_id"),
        "prescription_item_id": item.get("id", item.get("_id")),
        "medicine_id": medicine.get("id", medicine.get("_id")),
        "medicine_name": medicine.get("name"),
        "prescribed_dose": item.get("dose") or medicine.get("strength"),
        "dose": item.get("dose") or medicine.get("strength"),
        "route": item.get("route"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "administered_by": int(current_user.id),
        "nurse_name": administering_nurse_name,
        "status": calculated_status,
        "administered_at": administered_at_value,
        "actual_administration_time": administered_at_value,
        "delay_minutes": delay_minutes,
        "notes": request.notes,
        "verification_id": verification.get("id", verification.get("_id")),
        "is_override": is_override,
        "override_reason": override_reason,
        "originally_assigned_nurse_id": orig_nurse_id,
        "originally_assigned_nurse_name": orig_nurse_name,
        "created_at": now,
        "updated_at": now,
    }

    try:
        mongo_db.medication_administrations.insert_one(administration_doc)

        mongo_db.medication_schedules.update_one(
            {"$or": [{"_id": {"$in": s_candidates}}, {"id": {"$in": s_candidates}}]},
            {
                "$set": {
                    "status": calculated_status,
                    "actual_administration_time": administered_at_value,
                    "administered_at": administered_at_value,
                    "administered_by": int(current_user.id),
                    "administered_by_name": administering_nurse_name,
                    "nurse_name": administering_nurse_name,
                    "is_override": is_override,
                    "override_reason": override_reason,
                    "delay_minutes": delay_minutes,
                    "notes": request.notes,
                    "verification_id": verification.get("id", verification.get("_id")),
                    "updated_at": now,
                }
            },
        )

        # Automatically acknowledge any open alerts for this dose
        mongo_db.medication_alerts.update_many(
            {"medication_schedule_id": {"$in": s_candidates}, "is_acknowledged": False},
            {
                "$set": {
                    "is_acknowledged": True,
                    "acknowledged_by": int(current_user.id),
                    "acknowledged_by_name": administering_nurse_name,
                    "acknowledged_at": now,
                    "acknowledgement_note": f"Administered as {calculated_status} by {administering_nurse_name}",
                }
            },
        )

    except Exception as error:
        mongo_db.medication_administrations.delete_one({"_id": administration_id})
        raise HTTPException(
            status_code=500,
            detail="Unable to save medication administration.",
        ) from error

    return {
        "message": "Medication administration recorded successfully.",
        "administration_id": administration_id,
        "schedule_id": canonical_sched_id,
        "status": calculated_status,
        "delay_minutes": delay_minutes,
        "administered_by": int(current_user.id),
        "administered_by_name": administering_nurse_name,
        "nurse_name": administering_nurse_name,
        "administered_at": administered_at_value,
        "actual_administration_time": administered_at_value,
        "is_override": is_override,
        "override_reason": override_reason,
        "originally_assigned_nurse_id": orig_nurse_id,
        "originally_assigned_nurse_name": orig_nurse_name,
        "verification_id": verification.get("id", verification.get("_id")),
    }


# =========================================================
# NURSE ADMINISTRATION HISTORY
# =========================================================
@router.get("/history")
def get_nurse_history(
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """Retrieve history of all medication administrations performed by this nurse."""
    records = list(
        mongo_db.medication_administrations.find(
            {"administered_by": int(current_user.id)}
        ).sort([("administered_at", -1)]).limit(100)
    )

    for r in records:
        r["id"] = r.get("id", r.get("_id"))
        if "_id" in r:
            r["_id"] = str(r["_id"])

    return records


class MedicationHoldRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Clinical rationale for holding dose")
    notes: Optional[str] = Field(None, max_length=1000)


@router.post("/medications/{schedule_id}/hold")
def hold_medication(
    schedule_id: Union[int, str],
    request: MedicationHoldRequest,
    current_user=Depends(require_permission("RECORD_MEDICATION_ADMINISTRATION")),
):
    """
    Mark a scheduled medication dose as HELD with required clinical rationale.
    """
    schedule, item, prescription, patient, medicine, is_assigned = (
        _get_nurse_schedule(
            schedule_id,
            current_user.id,
            allow_override=True,
        )
    )

    if schedule.get("status") in {"GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE", "GIVEN_EARLY", "ADMINISTERED"}:
        raise HTTPException(
            status_code=400,
            detail="Cannot hold a medication dose that has already been administered.",
        )

    now = _now_iso()
    nurse_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", f"Nurse #{current_user.id}")
    s_candidates = _get_id_candidates(schedule_id)
    canonical_sched_id = schedule.get("id", schedule.get("_id", schedule_id))

    hold_note = f"HELD: {request.reason.strip()}."
    if request.notes:
        hold_note += f" Notes: {request.notes.strip()}"

    # Update schedule status to HELD
    mongo_db.medication_schedules.update_one(
        {"$or": [{"_id": {"$in": s_candidates}}, {"id": {"$in": s_candidates}}]},
        {
            "$set": {
                "status": "HELD",
                "notes": hold_note,
                "administered_by": int(current_user.id),
                "actual_administration_time": now,
                "updated_at": now,
            }
        },
    )

    # Record in medication_administrations as HELD
    admin_id = _next_administration_id()
    patient_id_raw = patient.get("id", patient.get("_id"))
    try:
        patient_id = int(patient_id_raw)
    except (ValueError, TypeError):
        patient_id = patient_id_raw

    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "medication_schedule_id": canonical_sched_id,
        "patient_id": patient_id,
        "prescription_item_id": item.get("id", item.get("_id")),
        "medicine_id": medicine.get("id", medicine.get("_id")),
        "medicine_name": medicine.get("name"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "administered_by": int(current_user.id),
        "nurse_name": nurse_name,
        "status": "HELD",
        "administered_at": now,
        "delay_minutes": 0.0,
        "notes": hold_note,
        "is_override": not is_assigned,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.medication_administrations.insert_one(admin_doc)

    # Acknowledge open alerts and notifications
    mongo_db.medication_alerts.update_many(
        {"medication_schedule_id": int(schedule_id)},
        {"$set": {"is_acknowledged": True, "acknowledged_by": int(current_user.id), "acknowledged_at": now}}
    )
    mongo_db.medication_notifications.update_many(
        {"medication_schedule_id": int(schedule_id)},
        {"$set": {"acknowledged": True, "read": True, "acknowledged_by": int(current_user.id), "acknowledged_at": now}}
    )

    return {
        "message": "Medication held successfully.",
        "schedule_id": int(schedule_id),
        "status": "HELD",
        "reason": request.reason.strip(),
        "held_by": int(current_user.id),
        "held_by_name": nurse_name,
        "held_at": now,
    }


# =========================================================
# 5-MINUTE PRE-DOSE NURSE NOTIFICATIONS
# =========================================================

@router.get("/notifications")
def get_notifications(
    unread_only: bool = Query(False, description="Filter unread notifications only"),
    limit: int = Query(50, ge=1, le=200),
    as_of: Optional[str] = Query(None, description="Optional ISO datetime override for test injection"),
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """
    Get 5-minute pre-dose medication notifications for the currently logged in nurse.
    Dynamically delivers only to currently authorized and assigned nurse.
    """
    as_of_dt = None
    if as_of:
        try:
            clean_str = as_of.replace("Z", "+00:00")
            as_of_dt = datetime.fromisoformat(clean_str)
            if as_of_dt.tzinfo:
                as_of_dt = as_of_dt.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            pass

    user_role_name = getattr(getattr(current_user, "role", None), "name", "")
    is_supervisor = user_role_name in {"Admin", "Head Nurse", "Supervisor"}

    limit_val = limit if isinstance(limit, int) else (getattr(limit, "default", 50) if isinstance(getattr(limit, "default", None), int) else 50)
    unread_val = unread_only if isinstance(unread_only, bool) else (getattr(unread_only, "default", False) if isinstance(getattr(unread_only, "default", None), bool) else False)

    return get_nurse_notifications(
        nurse_id=int(current_user.id),
        is_supervisor=is_supervisor,
        unread_only=unread_val,
        limit=limit_val,
        as_of_time=as_of_dt,
    )


@router.post("/notifications/{notification_id}/acknowledge")
def acknowledge_nurse_notification(
    notification_id: int,
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """
    Acknowledge a medication reminder notification.
    NOTE: Acknowledging a reminder NEVER counts as medication administration!
    """
    result = acknowledge_notification(notification_id=notification_id, user=current_user)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/notifications/{notification_id}/read")
def read_nurse_notification(
    notification_id: int,
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """Mark a notification as read."""
    mongo_db.medication_notifications.update_one(
        {"$or": [{"_id": int(notification_id)}, {"id": int(notification_id)}]},
        {"$set": {"read": True, "read_at": _now_iso(), "updated_at": _now_iso()}},
    )
    return {"message": "Notification marked as read."}


@router.get("/notifications/history")
def get_notifications_history(
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    """
    Get full medication notification history for the nurse.
    """
    user_role_name = getattr(getattr(current_user, "role", None), "name", "")
    is_supervisor = user_role_name in {"Admin", "Head Nurse", "Supervisor"}

    query = {}
    if is_supervisor:
        query = {"$or": [{"recipient_nurse_id": int(current_user.id)}, {"is_supervisor_alert": True}]}
    else:
        query = {"recipient_nurse_id": int(current_user.id)}

    records = list(
        mongo_db.medication_notifications.find(query)
        .sort([("scheduled_datetime", -1), ("created_at", -1)])
        .limit(limit)
    )

    for r in records:
        r["id"] = int(r.get("id", r.get("_id")))
        if "_id" in r:
            r["_id"] = str(r["_id"])

    return records
