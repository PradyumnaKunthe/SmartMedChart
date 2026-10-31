from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
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
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _by_id(collection_name: str, value):
    if value is None:
        return None

    try:
        numeric_id = int(value)
    except (TypeError, ValueError):
        return None

    return (
        mongo_db[collection_name].find_one({"_id": numeric_id})
        or mongo_db[collection_name].find_one({"id": numeric_id})
    )


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
    item = _by_id(
        "prescription_items",
        schedule.get("prescription_item_id"),
    )
    if not item:
        return None

    prescription = _by_id(
        "prescriptions",
        item.get("prescription_id"),
    )
    if not prescription:
        return None

    patient = _by_id(
        "patients",
        prescription.get("patient_id"),
    )
    medicine = _by_id(
        "medicines",
        item.get("medicine_id"),
    )

    if patient is None or medicine is None:
        return None

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

    return {
        "id": schedule.get("id", schedule.get("_id")),
        "prescription_item_id": schedule.get("prescription_item_id"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "status": schedule.get("status") or mon_status,
        "monitoring_status": mon_status,
        "delay_minutes": delay_mins,
        "actual_administration_time": schedule.get("actual_administration_time"),
        "administered_by": schedule.get("administered_by"),
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


def _get_nurse_schedule(schedule_id: int, nurse_id: int, allow_override: bool = False):
    schedule = _by_id("medication_schedules", schedule_id)
    if schedule is None:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    context = _schedule_context(schedule)
    if context is None:
        raise HTTPException(
            status_code=404,
            detail="Patient or medication details for this schedule were not found.",
        )

    item, prescription, patient, medicine = context
    patient_id = int(patient.get("id", patient.get("_id")))
    is_assigned = _is_patient_assigned(nurse_id, patient_id)

    if not is_assigned and not allow_override:
        raise HTTPException(
            status_code=403,
            detail="This patient is not assigned to this nurse.",
        )

    return schedule, item, prescription, patient, medicine, is_assigned


# =========================================================
# GET ALL NURSE MEDICATIONS
# =========================================================
@router.get(
    "/medications",
    response_model=list[MedicationScheduleResponse],
)
def get_nurse_medications(
    current_user=Depends(require_permission("VIEW_MEDICATION_SCHEDULE")),
):
    assigned_patient_ids = _assigned_patient_ids(current_user.id)
    if not assigned_patient_ids:
        return []

    results = []
    schedules = mongo_db.medication_schedules.find({}).sort(
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
    schedule_id: int,
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
    schedule_id: int,
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

    patient_id = int(patient.get("id", patient.get("_id")))

    # 1. Prevent duplicate administration records (concurrency protection)
    existing = mongo_db.medication_administrations.find_one(
        {"medication_schedule_id": int(schedule_id)}
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Medication schedule {schedule_id} already has an administration record.",
        )

    # 2. Require successful patient AND medication QR verification
    verification = mongo_db.qr_verifications.find_one(
        {
            "medication_schedule_id": int(schedule_id),
            "patient_id": patient_id,
            "verified_by": int(current_user.id),
            "patient_qr_valid": {"$in": [1, True]},
            "medication_valid": {"$in": [1, True]},
            "result": "SUCCESS",
        },
        sort=[("_id", -1)],
    )

    if verification is None:
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

    # 4. Calculate actual administration timing & on-time status
    administered_at = request.administered_at or datetime.now(timezone.utc)
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

    # Determine monitoring status
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

    administration_doc = {
        "_id": administration_id,
        "id": administration_id,
        "medication_schedule_id": int(schedule_id),
        "patient_id": patient_id,
        "prescription_item_id": int(item.get("id", item.get("_id"))),
        "medicine_id": int(medicine.get("id", medicine.get("_id"))),
        "medicine_name": medicine.get("name"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "administered_by": int(current_user.id),
        "nurse_name": administering_nurse_name,
        "status": calculated_status,
        "administered_at": administered_at_value,
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
            {"_id": int(schedule_id)},
            {
                "$set": {
                    "status": calculated_status,
                    "actual_administration_time": administered_at_value,
                    "administered_by": int(current_user.id),
                    "is_override": is_override,
                    "override_reason": override_reason,
                    "delay_minutes": delay_minutes,
                    "notes": request.notes,
                    "updated_at": now,
                }
            },
        )

        # Automatically acknowledge any open alerts for this dose
        mongo_db.medication_alerts.update_many(
            {"medication_schedule_id": int(schedule_id), "is_acknowledged": False},
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
        "schedule_id": int(schedule_id),
        "status": calculated_status,
        "delay_minutes": delay_minutes,
        "administered_by": int(current_user.id),
        "administered_by_name": administering_nurse_name,
        "administered_at": administered_at_value,
        "is_override": is_override,
        "override_reason": override_reason,
        "originally_assigned_nurse_id": orig_nurse_id,
        "originally_assigned_nurse_name": orig_nurse_name,
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
