
from datetime import date, datetime, time, timedelta
import re

from fastapi import APIRouter, Depends, HTTPException, Query

from app.mongo_client import mongo_db
from app.security import require_permission

from app.schemas.allergy import AllergyResponse
from app.schemas.current_medication import CurrentMedicationResponse
from app.schemas.medicine import MedicineResponse
from app.schemas.medication import MedicationScheduleResponse
from app.schemas.patient import PatientSearchResponse
from app.schemas.prescription import PrescriptionCreate
from app.schemas.prescription_history import PrescriptionHistoryResponse
from app.schemas.prescription_update import PrescriptionUpdate


router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor"],
)


# =========================================================
# COMMON HELPERS
# =========================================================

def mongo_now():
    return datetime.utcnow().isoformat(timespec="microseconds")


def mongo_bool(value):
    return value is True or value == 1 or str(value).lower() in (
        "true", "1", "yes"
    )


def active_filter():
    return {"$in": [True, 1]}


def next_mongo_id(collection_name: str) -> int:
    collection = mongo_db[collection_name]

    latest = collection.find_one(
        {},
        sort=[("_id", -1)],
        projection={"_id": 1},
    )

    maximum = (
        int(latest["_id"])
        if latest and isinstance(latest["_id"], int)
        else 0
    )

    counters = mongo_db["_id_sequences"]

    counters.update_one(
        {"_id": collection_name},
        {"$max": {"value": maximum}},
        upsert=True,
    )

    result = counters.find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"value": 1}},
        return_document=True,
    )

    return int(result["value"])


def patient_response(patient):
    return {
        "id": patient["id"],
        "patient_id": patient["patient_id"],
        "first_name": patient.get("first_name"),
        "last_name": patient.get("last_name"),
        "date_of_birth": patient.get("date_of_birth"),
        "gender": patient.get("gender"),
        "weight_kg": patient.get("weight_kg"),
        "ward_id": patient.get("ward_id"),
        "bed_id": patient.get("bed_id"),
        "is_active": mongo_bool(patient.get("is_active")),
        "created_at": patient.get("created_at"),
        "updated_at": patient.get("updated_at"),
    }


def get_doctor_patient_or_404(patient_id: int, current_user):
    """
    Return only an active patient assigned to the
    currently logged-in doctor through an active encounter.
    """

    patient = mongo_db.patients.find_one({
        "_id": patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    encounter = mongo_db.encounters.find_one({
        "patient_id": patient_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    return patient


# =========================================================
# MEDICATION SCHEDULE GENERATION
# =========================================================

FREQUENCY_HOURS = {
    "TWICE_DAILY": 12,
    "THREE_TIMES_DAILY": 8,
    "FOUR_TIMES_DAILY": 6,
    "EVERY_4_HOURS": 4,
    "EVERY_6_HOURS": 6,
    "EVERY_8_HOURS": 8,
    "EVERY_12_HOURS": 12,
}


def generate_schedule_times(
    start_date: date,
    start_time: time,
    duration_days: int,
    frequency: str,
):
    if duration_days <= 0:
        raise ValueError(
            "duration_days must be greater than zero."
        )

    frequency = frequency.upper().strip()

    first_datetime = datetime.combine(
        start_date,
        start_time,
    )

    if frequency in ("STAT", "ONCE"):
        return [first_datetime]

    if frequency == "ONCE_DAILY":
        return [
            first_datetime + timedelta(days=day)
            for day in range(duration_days)
        ]

    if frequency not in FREQUENCY_HOURS:
        raise ValueError(
            f"Unsupported medication frequency: {frequency}"
        )

    interval = timedelta(
        hours=FREQUENCY_HOURS[frequency]
    )

    end_datetime = (
        first_datetime + timedelta(days=duration_days)
    )

    schedules = []
    current_datetime = first_datetime

    while current_datetime < end_datetime:
        schedules.append(current_datetime)
        current_datetime += interval

    return schedules


def create_mongo_schedules(prescription_item):
    times = generate_schedule_times(
        start_date=date.fromisoformat(
            prescription_item["start_date"]
        ),
        start_time=time.fromisoformat(
            prescription_item["start_time"]
        ),
        duration_days=prescription_item["duration_days"],
        frequency=prescription_item["frequency"],
    )

    now = mongo_now()
    records = []

    for scheduled_datetime in times:
        schedule_id = next_mongo_id("medication_schedules")

        record = {
            "_id": schedule_id,
            "id": schedule_id,
            "prescription_item_id": prescription_item["id"],
            "scheduled_date": scheduled_datetime.date().isoformat(),
            "scheduled_time": scheduled_datetime.time().isoformat(),
            "status": "UPCOMING",
            "actual_administration_time": None,
            "administered_by": None,
            "notes": None,
            "created_at": now,
            "updated_at": now,
        }

        records.append(record)

    if records:
        mongo_db.medication_schedules.insert_many(records)

    return records


def schedule_has_history(schedule_id):
    return (
        mongo_db.medication_administrations.find_one({
            "medication_schedule_id": schedule_id
        }) is not None
        or mongo_db.qr_verifications.find_one({
            "medication_schedule_id": schedule_id
        }) is not None
        or mongo_db.ai_predictions.find_one({
            "medication_schedule_id": schedule_id
        }) is not None
    )


def remove_unadministered_schedules(prescription_item_id):
    schedules = list(
        mongo_db.medication_schedules.find({
            "prescription_item_id": prescription_item_id
        })
    )

    removed = 0

    for schedule in schedules:
        schedule_id = schedule["id"]

        if schedule_has_history(schedule_id):
            mongo_db.medication_schedules.update_one(
                {"_id": schedule_id},
                {"$set": {
                    "status": "CANCELLED",
                    "updated_at": mongo_now(),
                }},
            )
        else:
            mongo_db.medication_schedules.delete_one({
                "_id": schedule_id
            })

        removed += 1

    return removed


# =========================================================
# DOCTOR API TEST
# =========================================================

@router.get("/test")
def doctor_test(
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    return {
        "message": "Doctor API access granted.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }


# =========================================================
# SEARCH PATIENTS
# =========================================================

@router.get(
    "/patients",
    response_model=list[PatientSearchResponse],
)
def search_patients(
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    patient_ids = mongo_db.encounters.distinct(
        "patient_id",
        {
            "doctor_id": current_user.id,
            "status": "ACTIVE",
        },
    )

    if not patient_ids:
        return []

    query = {
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
    }

    if search:
        pattern = re.escape(search.strip())

        query["$or"] = [
            {"patient_id": {"$regex": pattern, "$options": "i"}},
            {"first_name": {"$regex": pattern, "$options": "i"}},
            {"last_name": {"$regex": pattern, "$options": "i"}},
        ]

    patients = list(
        mongo_db.patients.find(query).sort([
            ("last_name", 1),
            ("first_name", 1),
        ])
    )

    return [
        patient_response(patient)
        for patient in patients
    ]


# =========================================================
# GET SINGLE PATIENT
# =========================================================

@router.get(
    "/patients/{patient_id}",
    response_model=PatientSearchResponse,
)
def get_patient(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    patient = get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    return patient_response(patient)


# =========================================================
# GET PATIENT ALLERGIES
# =========================================================

@router.get(
    "/patients/{patient_id}/allergies",
    response_model=list[AllergyResponse],
)
def get_patient_allergies(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    allergies = list(
        mongo_db.patient_allergies.find({
            "patient_id": patient_id
        }).sort("id", 1)
    )

    return [
        {
            "id": allergy["id"],
            "patient_id": allergy["patient_id"],
            "allergen": allergy.get("allergen"),
            "reaction": allergy.get("reaction"),
            "severity": allergy.get("severity"),
            "notes": allergy.get("notes"),
        }
        for allergy in allergies
    ]


# =========================================================
# GET CURRENT MEDICATIONS
# =========================================================

@router.get(
    "/patients/{patient_id}/medications",
    response_model=list[CurrentMedicationResponse],
)
def get_current_medications(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": patient_id,
            "status": "ACTIVE",
        })
    )

    result = []

    for prescription in prescriptions:
        items = list(
            mongo_db.prescription_items.find({
                "prescription_id": prescription["id"],
                "status": "ACTIVE",
            })
        )

        for item in items:
            medicine = mongo_db.medicines.find_one({
                "_id": item["medicine_id"],
                "is_active": active_filter(),
            })

            if medicine is None:
                continue

            result.append({
                "prescription_id": prescription["id"],
                "prescription_item_id": item["id"],
                "medicine_id": medicine["id"],
                "medicine_name": medicine.get("name"),
                "generic_name": medicine.get("generic_name"),
                "strength": medicine.get("strength"),
                "dosage_form": medicine.get("dosage_form"),
                "dose": item.get("dose"),
                "route": item.get("route"),
                "frequency": item.get("frequency"),
                "duration_days": item.get("duration_days"),
                "start_date": item.get("start_date"),
                "start_time": item.get("start_time"),
                "is_stat": mongo_bool(item.get("is_stat")),
                "instructions": item.get("instructions"),
                "status": item.get("status"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
            })

    result.sort(
        key=lambda item: (
            item.get("start_date") or "",
            item.get("medicine_name") or "",
        )
    )

    return result


# =========================================================
# GET PATIENT MEDICATION SCHEDULES
# =========================================================

@router.get(
    "/patients/{patient_id}/medication-schedules",
    response_model=list[MedicationScheduleResponse],
)
def get_patient_medication_schedules(
    patient_id: int,
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": patient_id
        })
    )

    prescription_ids = [
        prescription["id"]
        for prescription in prescriptions
    ]

    if not prescription_ids:
        return []

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": {"$in": prescription_ids}
        })
    )

    item_ids = [
        item["id"]
        for item in items
    ]

    if not item_ids:
        return []

    schedules = list(
        mongo_db.medication_schedules.find({
            "prescription_item_id": {"$in": item_ids}
        }).sort([
            ("scheduled_date", 1),
            ("scheduled_time", 1),
            ("id", 1),
        ])
    )

    return schedules


# =========================================================
# MEDICINE CATALOGUE
# =========================================================

@router.get(
    "/medicines",
    response_model=list[MedicineResponse],
)
def get_medicines(
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    medicines = list(
        mongo_db.medicines.find({
            "is_active": active_filter()
        }).sort("name", 1)
    )

    return [
        {
            "id": medicine["id"],
            "name": medicine.get("name"),
            "generic_name": medicine.get("generic_name"),
            "strength": medicine.get("strength"),
            "dosage_form": medicine.get("dosage_form"),
            "description": medicine.get("description"),
            "is_active": mongo_bool(medicine.get("is_active")),
            "created_at": medicine.get("created_at"),
            "updated_at": medicine.get("updated_at"),
        }
        for medicine in medicines
    ]


# =========================================================
# CREATE PRESCRIPTION
# =========================================================

@router.post("/prescriptions")
def create_prescription(
    request: PrescriptionCreate,
    current_user=Depends(
        require_permission("CREATE_PRESCRIPTION")
    ),
):
    patient = get_doctor_patient_or_404(
        request.patient_id,
        current_user,
    )

    medicine = mongo_db.medicines.find_one({
        "_id": request.medicine_id,
        "is_active": active_filter(),
    })

    if medicine is None:
        raise HTTPException(
            status_code=404,
            detail="Medicine not found.",
        )

    frequency = request.frequency.upper().strip()

    # Validate frequency before writing anything.
    try:
        schedule_times = generate_schedule_times(
            start_date=request.start_date,
            start_time=request.start_time,
            duration_days=request.duration_days,
            frequency=frequency,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    now = mongo_now()

    prescription_id = next_mongo_id("prescriptions")
    item_id = next_mongo_id("prescription_items")

    prescription = {
        "_id": prescription_id,
        "id": prescription_id,
        "patient_id": patient["id"],
        "doctor_id": current_user.id,
        "status": "ACTIVE",
        "notes": request.notes,
        "created_at": now,
        "updated_at": now,
    }

    item = {
        "_id": item_id,
        "id": item_id,
        "prescription_id": prescription_id,
        "medicine_id": medicine["id"],
        "dose": request.dose,
        "route": request.route,
        "frequency": frequency,
        "duration_days": request.duration_days,
        "start_date": request.start_date.isoformat(),
        "start_time": request.start_time.isoformat(),
        "is_stat": request.is_stat,
        "instructions": request.instructions,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
    }

    created_schedule_ids = []

    try:
        mongo_db.prescriptions.insert_one(prescription)

        mongo_db.prescription_items.insert_one(item)

        schedule_records = []

        for scheduled_datetime in schedule_times:
            schedule_id = next_mongo_id(
                "medication_schedules"
            )

            schedule = {
                "_id": schedule_id,
                "id": schedule_id,
                "prescription_item_id": item_id,
                "scheduled_date": scheduled_datetime.date().isoformat(),
                "scheduled_time": scheduled_datetime.time().isoformat(),
                "status": "UPCOMING",
                "actual_administration_time": None,
                "administered_by": None,
                "notes": None,
                "created_at": now,
                "updated_at": now,
            }

            schedule_records.append(schedule)
            created_schedule_ids.append(schedule_id)

        if schedule_records:
            mongo_db.medication_schedules.insert_many(
                schedule_records
            )

    except Exception as exc:
        if created_schedule_ids:
            mongo_db.medication_schedules.delete_many({
                "_id": {"$in": created_schedule_ids}
            })

        mongo_db.prescription_items.delete_one({
            "_id": item_id
        })

        mongo_db.prescriptions.delete_one({
            "_id": prescription_id
        })

        raise HTTPException(
            status_code=500,
            detail="Prescription creation failed.",
        ) from exc

    return {
        "message": "Prescription created successfully.",
        "prescription_id": prescription_id,
        "prescription_item_id": item_id,
        "patient_id": patient["id"],
        "doctor_id": current_user.id,
        "medicine_id": medicine["id"],
        "medicine_name": medicine.get("name"),
        "dose": item["dose"],
        "route": item["route"],
        "frequency": item["frequency"],
        "duration_days": item["duration_days"],
        "start_date": item["start_date"],
        "start_time": item["start_time"],
        "is_stat": item["is_stat"],
        "schedule_count": len(schedule_records),
    }


# =========================================================
# UPDATE PRESCRIPTION
# =========================================================

@router.put("/prescriptions/{prescription_id}")
def update_prescription(
    prescription_id: int,
    request: PrescriptionUpdate,
    current_user=Depends(
        require_permission("EDIT_PRESCRIPTION")
    ),
):
    prescription = mongo_db.prescriptions.find_one({
        "_id": prescription_id
    })

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found.",
        )

    if prescription.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active prescriptions can be edited.",
        )

    item = mongo_db.prescription_items.find_one({
        "prescription_id": prescription_id
    })

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription item not found.",
        )

    update_data = request.model_dump(
        exclude_unset=True
    )

    notes_were_provided = "notes" in update_data
    notes_value = update_data.pop("notes", None)

    if notes_were_provided:
        mongo_db.prescriptions.update_one(
            {"_id": prescription_id},
            {"$set": {
                "notes": notes_value,
                "updated_at": mongo_now(),
            }},
        )

    if "start_date" in update_data and update_data["start_date"]:
        update_data["start_date"] = (
            update_data["start_date"].isoformat()
        )

    if "start_time" in update_data and update_data["start_time"]:
        update_data["start_time"] = (
            update_data["start_time"].isoformat()
        )

    if "frequency" in update_data and update_data["frequency"]:
        update_data["frequency"] = (
            update_data["frequency"].upper().strip()
        )

    updated_item = {
        **item,
        **update_data,
    }

    # Validate the replacement schedule before changing records.
    try:
        schedule_times = generate_schedule_times(
            start_date=date.fromisoformat(
                updated_item["start_date"]
            ),
            start_time=time.fromisoformat(
                updated_item["start_time"]
            ),
            duration_days=updated_item["duration_days"],
            frequency=updated_item["frequency"],
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    now = mongo_now()

    update_data["updated_at"] = now

    mongo_db.prescription_items.update_one(
        {"_id": item["id"]},
        {"$set": update_data},
    )

    updated_item.update(update_data)

    # Remove unused future schedules but preserve records
    # referenced by medication administration, AI or QR history.
    remove_unadministered_schedules(item["id"])

    new_schedules = []

    for scheduled_datetime in schedule_times:
        schedule_id = next_mongo_id(
            "medication_schedules"
        )

        new_schedules.append({
            "_id": schedule_id,
            "id": schedule_id,
            "prescription_item_id": item["id"],
            "scheduled_date": scheduled_datetime.date().isoformat(),
            "scheduled_time": scheduled_datetime.time().isoformat(),
            "status": "UPCOMING",
            "actual_administration_time": None,
            "administered_by": None,
            "notes": None,
            "created_at": now,
            "updated_at": now,
        })

    if new_schedules:
        mongo_db.medication_schedules.insert_many(
            new_schedules
        )

    return {
        "message": "Prescription updated successfully.",
        "prescription_id": prescription_id,
        "prescription_item_id": item["id"],
        "patient_id": prescription["patient_id"],
        "doctor_id": prescription["doctor_id"],
        "medicine_id": updated_item["medicine_id"],
        "dose": updated_item["dose"],
        "route": updated_item["route"],
        "frequency": updated_item["frequency"],
        "duration_days": updated_item["duration_days"],
        "start_date": updated_item["start_date"],
        "start_time": updated_item["start_time"],
        "is_stat": updated_item["is_stat"],
        "instructions": updated_item.get("instructions"),
        "status": updated_item["status"],
        "schedule_count": len(new_schedules),
    }


# =========================================================
# STOP PRESCRIPTION
# =========================================================

@router.post(
    "/prescriptions/{prescription_id}/stop"
)
def stop_prescription(
    prescription_id: int,
    current_user=Depends(
        require_permission("STOP_PRESCRIPTION")
    ),
):
    prescription = mongo_db.prescriptions.find_one({
        "_id": prescription_id
    })

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found.",
        )

    if prescription.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active prescriptions can be stopped.",
        )

    now = mongo_now()

    mongo_db.prescriptions.update_one(
        {"_id": prescription_id},
        {"$set": {
            "status": "STOPPED",
            "updated_at": now,
        }},
    )

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": prescription_id
        })
    )

    removed_schedules = 0

    for item in items:
        mongo_db.prescription_items.update_one(
            {"_id": item["id"]},
            {"$set": {
                "status": "STOPPED",
                "updated_at": now,
            }},
        )

        removed_schedules += remove_unadministered_schedules(
            item["id"]
        )

    return {
        "message": "Prescription stopped successfully.",
        "prescription_id": prescription_id,
        "status": "STOPPED",
        "removed_future_schedules": removed_schedules,
    }


# =========================================================
# PRESCRIPTION HISTORY
# =========================================================

@router.get(
    "/patients/{patient_id}/prescriptions",
    response_model=list[PrescriptionHistoryResponse],
)
def get_prescription_history(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": patient_id
        }).sort("created_at", -1)
    )

    result = []

    for prescription in prescriptions:
        items = list(
            mongo_db.prescription_items.find({
                "prescription_id": prescription["id"]
            }).sort("id", -1)
        )

        for item in items:
            medicine = mongo_db.medicines.find_one({
                "_id": item["medicine_id"]
            })

            if medicine is None:
                continue

            result.append({
                "prescription_id": prescription["id"],
                "prescription_item_id": item["id"],
                "patient_id": prescription["patient_id"],
                "doctor_id": prescription["doctor_id"],
                "medicine_id": medicine["id"],
                "medicine_name": medicine.get("name"),
                "generic_name": medicine.get("generic_name"),
                "strength": medicine.get("strength"),
                "dosage_form": medicine.get("dosage_form"),
                "dose": item.get("dose"),
                "route": item.get("route"),
                "frequency": item.get("frequency"),
                "duration_days": item.get("duration_days"),
                "start_date": item.get("start_date"),
                "start_time": item.get("start_time"),
                "is_stat": mongo_bool(item.get("is_stat")),
                "instructions": item.get("instructions"),
                "prescription_status": prescription.get("status"),
                "item_status": item.get("status"),
                "prescription_notes": prescription.get("notes"),
                "created_at": prescription.get("created_at"),
                "updated_at": prescription.get("updated_at"),
            })

    return result
