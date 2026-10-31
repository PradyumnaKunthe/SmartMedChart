
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from app.mongo_client import mongo_db
from app.schemas.administration import MedicationAdministrationCreate
from app.schemas.medication import MedicationScheduleResponse
from app.security import require_permission


router = APIRouter(prefix="/api/nurse", tags=["Nurse"])


VALID_ADMINISTRATION_STATUSES = {
    "GIVEN",
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


def _build_medication_response(schedule, item, patient, medicine):
    first_name = (patient.get("first_name") or "").strip()
    last_name = (patient.get("last_name") or "").strip()
    patient_name = f"{first_name} {last_name}".strip() or None

    return {
        "id": schedule.get("id", schedule.get("_id")),
        "prescription_item_id": schedule.get("prescription_item_id"),
        "scheduled_date": schedule.get("scheduled_date"),
        "scheduled_time": schedule.get("scheduled_time"),
        "status": schedule.get("status"),
        "actual_administration_time": schedule.get(
            "actual_administration_time"
        ),
        "administered_by": schedule.get("administered_by"),
        "notes": schedule.get("notes"),

        "patient_id": patient.get("id", patient.get("_id")),
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
    }


def _get_nurse_schedule(schedule_id: int, nurse_id: int):
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

    if not _is_patient_assigned(nurse_id, patient_id):
        raise HTTPException(
            status_code=403,
            detail="This patient is not assigned to this nurse.",
        )

    return schedule, item, prescription, patient, medicine


# =========================================================
# GET ALL NURSE MEDICATIONS
# =========================================================

@router.get(
    "/medications",
    response_model=list[MedicationScheduleResponse],
)
def get_nurse_medications(
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
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
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    schedule, item, prescription, patient, medicine = (
        _get_nurse_schedule(
            schedule_id,
            current_user.id,
        )
    )

    return _build_medication_response(
        schedule,
        item,
        patient,
        medicine,
    )


# =========================================================
# GENERATE ADMINISTRATION ID
# =========================================================

def _next_administration_id() -> int:
    collection = mongo_db.medication_administrations

    last = collection.find_one(
        sort=[("_id", -1)]
    )

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
# ADMINISTER MEDICATION
# =========================================================

@router.post("/medications/{schedule_id}/administer")
def administer_medication(
    schedule_id: int,
    request: MedicationAdministrationCreate,
    current_user=Depends(
        require_permission("ADMINISTER_MEDICATION")
    ),
):
    schedule, item, prescription, patient, medicine = (
        _get_nurse_schedule(
            schedule_id,
            current_user.id,
        )
    )

    status = (request.status or "").strip().upper()

    if status not in VALID_ADMINISTRATION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid administration status. Allowed values: "
                + ", ".join(sorted(VALID_ADMINISTRATION_STATUSES))
            ),
        )

    patient_id = int(patient.get("id", patient.get("_id")))

    # Require successful patient AND medication QR verification.
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

    # Prevent duplicate administration records.
    existing = mongo_db.medication_administrations.find_one(
        {"medication_schedule_id": int(schedule_id)}
    )

    if existing is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Medication schedule {schedule_id} "
                "already has an administration record."
            ),
        )

    administered_at = (
        request.administered_at
        or datetime.now(timezone.utc)
    )

    administered_at_value = (
        administered_at.isoformat()
        if hasattr(administered_at, "isoformat")
        else str(administered_at)
    )

    now = _now_iso()
    administration_id = _next_administration_id()

    administration = {
        "_id": administration_id,
        "id": administration_id,
        "medication_schedule_id": int(schedule_id),
        "administered_by": int(current_user.id),
        "status": status,
        "administered_at": administered_at_value,
        "notes": request.notes,
        "created_at": now,
        "updated_at": now,
    }

    try:
        mongo_db.medication_administrations.insert_one(
            administration
        )

        mongo_db.medication_schedules.update_one(
            {"_id": int(schedule_id)},
            {
                "$set": {
                    "status": status,
                    "actual_administration_time": administered_at_value,
                    "administered_by": int(current_user.id),
                    "updated_at": now,
                }
            },
        )

    except Exception as error:
        mongo_db.medication_administrations.delete_one(
            {"_id": administration_id}
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to save medication administration.",
        ) from error

    return {
        "message": "Medication administration recorded successfully.",
        "administration_id": administration_id,
        "schedule_id": int(schedule_id),
        "status": status,
        "administered_by": int(current_user.id),
        "administered_at": administered_at_value,
    }
