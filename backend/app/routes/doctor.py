
from datetime import date, datetime, time, timedelta
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

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


class RoundVerifyQRRequest(BaseModel):
    qr_token: str


class RoundAssessmentCreate(BaseModel):
    patient_id: int
    improvement_percentage: int = Field(..., ge=0, le=100)
    clinical_notes: str | None = None

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

    return int(result["value"]) if result else 1


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


def get_doctor_patient_or_404(patient_id: Any, current_user):
    """
    Return only an active patient assigned to the
    currently logged-in doctor through an active encounter.
    """
    queries: list[dict[str, Any]] = [{"patient_id": str(patient_id).strip()}]
    try:
        numeric_id = int(patient_id)
        queries.extend([{"_id": numeric_id}, {"id": numeric_id}])
    except (ValueError, TypeError):
        pass

    patient = mongo_db.patients.find_one({"$or": queries})

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not mongo_bool(patient.get("is_active")) or patient.get("lifecycle_status") == "DISCHARGED":
        raise HTTPException(
            status_code=400,
            detail="Cannot create prescription for a discharged patient.",
        )

    actual_id = int(patient.get("id", patient.get("_id")))

    encounter = mongo_db.encounters.find_one({
        "patient_id": actual_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=403,
            detail="Patient is not assigned to this doctor.",
        )

    return patient


def get_doctor_patient_history_or_404(patient_id: Any, current_user):
    """
    Verify that the patient exists and has at least one clinical
    encounter linked to the logged-in doctor (active or discharged).
    """
    queries: list[dict[str, Any]] = [{"patient_id": str(patient_id).strip()}]
    try:
        numeric_id = int(patient_id)
        queries.extend([{"_id": numeric_id}, {"id": numeric_id}])
    except (ValueError, TypeError):
        pass

    patient = mongo_db.patients.find_one({"$or": queries})

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    actual_id = int(patient.get("id", patient.get("_id")))

    encounter = mongo_db.encounters.find_one({
        "patient_id": actual_id,
        "doctor_id": current_user.id,
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


from app.services.scheduling_service import (
    generate_schedule_times as service_generate_schedule_times,
    normalize_frequency,
)
from app.services.notification_service import (
    create_notification_jobs_for_schedules,
    init_notification_indexes,
)


def generate_schedule_times(
    start_date: date,
    start_time: time,
    duration_days: int,
    frequency: str,
    administration_times=None,
):
    return service_generate_schedule_times(
        start_date=start_date,
        start_time=start_time,
        duration_days=duration_days,
        frequency=frequency,
        administration_times=administration_times,
    )


def old_generate_schedule_times(
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

        # 1. If schedule was already administered or given, preserve it completely!
        if (
            schedule.get("status") in ("ADMINISTERED", "GIVEN")
            or schedule.get("actual_administration_time") is not None
        ):
            continue

        # 2. If it has verification/prediction or other history, mark CANCELLED to preserve audit trail
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

        # Clean up any pending nurse notifications for this unadministered schedule
        mongo_db.medication_notifications.delete_many({
            "medication_schedule_id": schedule_id,
            "status": "PENDING",
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
    search: Optional[str] = Query(
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
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }

    search_term = None if (search is None or hasattr(search, 'default')) else str(search).strip()
    if search_term:
        pattern = re.escape(search_term)

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
    patient_id: str,
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
    patient_id: str,
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
    patient_id: str,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    patient = get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    actual_patient_id = int(patient.get("id", patient.get("_id")))
    patient_str_id = patient.get("patient_id")
    target_ids = [actual_patient_id, str(actual_patient_id)]
    if patient_str_id:
        target_ids.append(patient_str_id)

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": {"$in": target_ids},
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
                "dosage": item.get("dose"),
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
            str(item.get("start_date") or ""),
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
    patient = get_doctor_patient_or_404(
        patient_id,
        current_user,
    )

    actual_patient_id = int(patient.get("id", patient.get("_id")))
    patient_str_id = patient.get("patient_id")
    target_ids = [actual_patient_id, str(actual_patient_id)]
    if patient_str_id:
        target_ids.append(patient_str_id)

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": {"$in": target_ids}
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
            "is_active": active_filter(),
            "is_archived": {"$ne": True},
            "is_test": {"$ne": True},
            "name": {"$not": {"$regex": "^(test |duplicate |status test)", "$options": "i"}},
        }).sort("name", 1)
    )

    result = []
    for medicine in medicines:
        # Calculate real-time available stock across active batches
        batches = list(
            mongo_db.medicine_batches.find({
                "medicine_id": medicine["id"],
                "status": "ACTIVE",
                "current_quantity": {"$gt": 0},
            })
        )
        batch_stock = sum(int(b.get("current_quantity", 0)) for b in batches)
        total_stock = max(int(medicine.get("total_stock", 0)), batch_stock)
        min_level = int(medicine.get("min_stock_level") or 10)

        if total_stock == 0:
            stock_status = "OUT OF STOCK"
        elif total_stock <= min_level:
            stock_status = "LOW STOCK"
        else:
            stock_status = "IN STOCK"

        result.append({
            "id": medicine["id"],
            "name": medicine.get("name"),
            "generic_name": medicine.get("generic_name"),
            "brand_name": medicine.get("brand_name"),
            "strength": medicine.get("strength"),
            "dosage_form": medicine.get("dosage_form"),
            "unit": medicine.get("unit") or "Tablets",
            "category": medicine.get("category") or "General",
            "min_stock_level": min_level,
            "supplier": medicine.get("supplier"),
            "total_stock": total_stock,
            "stock_status": stock_status,
            "description": medicine.get("description"),
            "is_active": mongo_bool(medicine.get("is_active")),
            "is_archived": bool(medicine.get("is_archived", False)),
            "created_at": medicine.get("created_at"),
            "updated_at": medicine.get("updated_at"),
        })

    return result


# =========================================================
# AVAILABLE NURSES & PATIENT NURSE ASSIGNMENT (DOCTOR ACCESS)
# =========================================================

@router.get("/available-nurses")
def get_available_nurses(
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    Retrieve all registered active nurses for inpatient admission assignment.
    Doctors must not access admin endpoints; this endpoint provides safe,
    authenticated nurse directory access.
    """
    nurse_role = mongo_db.roles.find_one({"name": {"$regex": "^nurse$", "$options": "i"}})
    if not nurse_role:
        return []

    nurse_role_id = nurse_role.get("id", nurse_role.get("_id"))

    nurses = list(
        mongo_db.users.find({
            "role_id": nurse_role_id,
            "is_active": active_filter(),
        }).sort([("full_name", 1), ("username", 1)])
    )

    return [
        {
            "id": n.get("id", n.get("_id")),
            "nurse_id": n.get("id", n.get("_id")),
            "username": n.get("username"),
            "full_name": n.get("full_name") or n.get("username"),
            "email": n.get("email"),
            "role": "Nurse",
        }
        for n in nurses
    ]


@router.get("/patients/{patient_id}/assigned-nurse")
def get_patient_assigned_nurse(
    patient_id: str,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    Retrieve the current active assigned nurse for the specified patient under doctor's care.
    """
    patient = get_doctor_patient_or_404(patient_id, current_user)
    patient_id_int = int(patient.get("id", patient.get("_id")))

    assignment = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": patient_id_int,
        "is_active": {"$in": [1, True]},
    })

    if not assignment or not assignment.get("nurse_id"):
        return {"assigned_nurse": None}

    nurse_id = int(assignment["nurse_id"])
    nurse_user = mongo_db.users.find_one({"$or": [{"_id": nurse_id}, {"id": nurse_id}]})
    nurse_name = (
        nurse_user.get("full_name")
        or nurse_user.get("username")
        if nurse_user
        else f"Nurse #{nurse_id}"
    )

    return {
        "assigned_nurse": {
            "assignment_id": assignment.get("id", assignment.get("_id")),
            "nurse_id": nurse_id,
            "nurse_name": nurse_name,
            "username": nurse_user.get("username") if nurse_user else None,
            "assigned_at": assignment.get("assigned_at"),
            "is_active": True,
        }
    }


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
    patient_id_int = int(patient.get("id") or patient.get("_id"))

    # 1. Normalize list of medicine items (support multi-medicine or legacy single-medicine)
    raw_medicines = []
    if request.medicines and len(request.medicines) > 0:
        for m in request.medicines:
            raw_medicines.append(m if isinstance(m, dict) else m.dict())
    elif request.medicine_id:
        raw_medicines.append({
            "medicine_id": request.medicine_id,
            "dose": request.dose,
            "route": request.route,
            "frequency": request.frequency,
            "duration_days": request.duration_days or 1,
            "start_date": request.start_date,
            "start_time": request.start_time,
            "administration_times": getattr(request, "administration_times", []) or [],
            "is_stat": getattr(request, "is_stat", False),
            "instructions": getattr(request, "instructions", None),
        })
    else:
        raise HTTPException(
            status_code=400,
            detail="At least one medicine item must be specified in the prescription order.",
        )

    # 2. Comprehensive validation across all items BEFORE writing to DB
    validated_items = []

    replaced_rx = None
    if getattr(request, "replaces_prescription_id", None):
        target_pid = patient["id"]
        replaced_rx = mongo_db.prescriptions.find_one({
            "$or": [
                {"_id": request.replaces_prescription_id},
                {"id": request.replaces_prescription_id},
            ],
            "patient_id": {"$in": [target_pid, str(target_pid), patient.get("patient_id")]},
        })
        if not replaced_rx:
            raise HTTPException(
                status_code=404,
                detail=f"Prescription #{request.replaces_prescription_id} not found for this patient.",
            )
        if replaced_rx.get("status") != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Only active prescriptions can be replaced.",
            )

    active_rx_ids = mongo_db.prescriptions.distinct(
        "_id",
        {"patient_id": {"$in": [patient["id"], str(patient["id"]), patient.get("patient_id")]}, "status": "ACTIVE"}
    )
    if replaced_rx:
        rep_id = int(replaced_rx.get("id") or replaced_rx.get("_id"))
        active_rx_ids = [rid for rid in active_rx_ids if rid != rep_id and str(rid) != str(rep_id)]

    seen_in_request = set()

    for idx, med_input in enumerate(raw_medicines, start=1):
        med_id = int(med_input["medicine_id"])
        dose_str = str(med_input.get("dose") or "").strip()
        route_str = str(med_input.get("route") or "Oral").strip()
        freq_raw = str(med_input.get("frequency") or "ONCE_DAILY").strip()
        canonical_freq = normalize_frequency(freq_raw)
        dur_days = int(med_input.get("duration_days") or 1)
        start_d = med_input["start_date"]
        start_t = med_input["start_time"]
        admin_times = med_input.get("administration_times") or []
        is_stat = bool(med_input.get("is_stat", False))
        instructions = med_input.get("instructions")

        if not dose_str:
            raise HTTPException(status_code=400, detail=f"Dose is required for medicine #{idx}.")

        medicine = mongo_db.medicines.find_one({
            "_id": med_id,
            "is_active": active_filter(),
        })
        if medicine is None:
            raise HTTPException(
                status_code=404,
                detail=f"Medicine #{med_id} not found or inactive in the pharmacy catalogue.",
            )

        # Check duplicate inside current request
        req_key = (med_id, dose_str.lower(), canonical_freq)
        if req_key in seen_in_request:
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate entry for {medicine.get('name')} ({dose_str}) in the same prescription.",
            )
        seen_in_request.add(req_key)

        # Check duplicate against existing active prescriptions in database
        if active_rx_ids:
            duplicate = mongo_db.prescription_items.find_one({
                "prescription_id": {"$in": active_rx_ids},
                "medicine_id": medicine["id"],
                "dose": dose_str,
                "frequency": canonical_freq,
                "status": "ACTIVE",
            })
            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail=f"An active prescription for {medicine.get('name')} ({dose_str}) already exists for this patient. Please review active regimens to avoid duplicate orders.",
                )

        # Validate schedule times generation
        try:
            schedule_times = generate_schedule_times(
                start_date=start_d,
                start_time=start_t,
                duration_days=dur_days,
                frequency=canonical_freq,
                administration_times=admin_times,
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=f"{medicine.get('name')}: {str(error)}",
            ) from error

        validated_items.append({
            "medicine": medicine,
            "dose": dose_str,
            "route": route_str,
            "frequency": canonical_freq,
            "duration_days": dur_days,
            "start_date": start_d.isoformat() if hasattr(start_d, "isoformat") else str(start_d),
            "start_time": start_t.isoformat() if hasattr(start_t, "isoformat") else str(start_t),
            "administration_times": admin_times,
            "is_stat": is_stat,
            "instructions": instructions,
            "schedule_times": schedule_times,
        })

    # 3. Transactional Write to MongoDB
    now = mongo_now()
    prescription_id = next_mongo_id("prescriptions")

    prescription = {
        "_id": prescription_id,
        "id": prescription_id,
        "patient_id": patient["id"],
        "doctor_id": current_user.id,
        "status": "ACTIVE",
        "notes": request.notes,
        "replaces_prescription_id": int(replaced_rx.get("id") or replaced_rx.get("_id")) if replaced_rx else None,
        "item_count": len(validated_items),
        "created_at": now,
        "updated_at": now,
    }

    created_item_ids = []
    created_schedule_ids = []
    created_items_summary = []
    all_schedules_for_notifs = []
    allocated_bed_id = None
    prev_bed_id = None
    new_assignment_created_id = None
    deactivated_prev_assignment_id = None

    try:
        mongo_db.prescriptions.insert_one(prescription)

        for v_item in validated_items:
            item_id = next_mongo_id("prescription_items")
            med_doc = v_item["medicine"]

            db_item = {
                "_id": item_id,
                "id": item_id,
                "prescription_id": prescription_id,
                "medicine_id": med_doc["id"],
                "medicine_name": med_doc.get("name"),
                "dose": v_item["dose"],
                "route": v_item["route"],
                "frequency": v_item["frequency"],
                "duration_days": v_item["duration_days"],
                "start_date": v_item["start_date"],
                "start_time": v_item["start_time"],
                "administration_times": v_item["administration_times"],
                "is_stat": v_item["is_stat"],
                "instructions": v_item["instructions"],
                "status": "ACTIVE",
                "created_at": now,
                "updated_at": now,
            }
            mongo_db.prescription_items.insert_one(db_item)
            created_item_ids.append(item_id)

            item_schedules = []
            for s_time in v_item["schedule_times"]:
                s_id = next_mongo_id("medication_schedules")
                s_record = {
                    "_id": s_id,
                    "id": s_id,
                    "prescription_id": prescription_id,
                    "prescription_item_id": item_id,
                    "patient_id": patient["id"],
                    "medicine_id": med_doc["id"],
                    "medicine_name": med_doc.get("name"),
                    "dose": v_item["dose"],
                    "route": v_item["route"],
                    "scheduled_date": s_time.date().isoformat(),
                    "scheduled_time": s_time.time().isoformat(),
                    "status": "SCHEDULED",
                    "is_stat": v_item["is_stat"],
                    "instructions": v_item["instructions"],
                    "actual_administration_time": None,
                    "administered_by": None,
                    "notes": None,
                    "created_at": now,
                    "updated_at": now,
                }
                item_schedules.append(s_record)
                created_schedule_ids.append(s_id)
                all_schedules_for_notifs.append(s_record)

            if item_schedules:
                mongo_db.medication_schedules.insert_many(item_schedules)

            created_items_summary.append({
                "id": item_id,
                "prescription_item_id": item_id,
                "medicine_id": med_doc["id"],
                "medicine_name": med_doc.get("name"),
                "dose": v_item["dose"],
                "route": v_item["route"],
                "frequency": v_item["frequency"],
                "duration_days": v_item["duration_days"],
                "start_date": v_item["start_date"],
                "start_time": v_item["start_time"],
                "is_stat": v_item["is_stat"],
                "instructions": v_item["instructions"],
                "schedule_count": len(item_schedules),
            })

        # Generate 5-minute pre-dose nurse notification jobs for all schedules
        if all_schedules_for_notifs:
            create_notification_jobs_for_schedules(
                schedules=all_schedules_for_notifs,
                patient=patient,
            )

        # Handle inpatient admission & bed allocation if requested
        bed_info = None
        nurse_info = None
        admit_patient_requested = getattr(request, "admit_patient", False)
        if admit_patient_requested:
            if not request.ward_id or not request.bed_id:
                raise HTTPException(
                    status_code=400,
                    detail="Hospital ward and unoccupied bed selection are required for inpatient admission.",
                )

            # 1. Prevent assigning beds to discharged or inactive patients
            if not mongo_bool(patient.get("is_active")) or patient.get("lifecycle_status") == "DISCHARGED":
                raise HTTPException(
                    status_code=400,
                    detail="Cannot assign a hospital bed to a discharged or inactive patient.",
                )

            req_ward_id = int(request.ward_id)
            req_bed_id = int(request.bed_id)

            # Validate nurse if provided
            req_nurse_id = getattr(request, "nurse_id", None)
            nurse_user = None
            if req_nurse_id is not None:
                try:
                    req_nurse_id = int(req_nurse_id)
                except (ValueError, TypeError):
                    raise HTTPException(status_code=400, detail="Invalid nurse ID format.")

                nurse_user = mongo_db.users.find_one({
                    "$or": [{"_id": req_nurse_id}, {"id": req_nurse_id}],
                })
                if not nurse_user:
                    raise HTTPException(status_code=404, detail="Selected nurse not found.")

                if not mongo_bool(nurse_user.get("is_active")):
                    raise HTTPException(status_code=400, detail="Selected nurse account is inactive.")

                # Validate Nurse role
                nurse_role = mongo_db.roles.find_one({"name": {"$regex": "^nurse$", "$options": "i"}})
                nurse_role_id = nurse_role.get("id", nurse_role.get("_id")) if nurse_role else 2
                if nurse_user.get("role_id") != nurse_role_id:
                    raise HTTPException(status_code=400, detail="Selected staff member does not have the Nurse role.")

            # 2. Validate ward exists and is active
            ward = mongo_db.wards.find_one({
                "$or": [{"_id": req_ward_id}, {"id": req_ward_id}, {"_id": str(req_ward_id)}, {"id": str(req_ward_id)}],
                "is_active": active_filter(),
            })
            if not ward:
                raise HTTPException(status_code=404, detail="Selected hospital ward not found or inactive.")

            # 3. Validate bed exists, belongs to ward, and is active
            bed = mongo_db.beds.find_one({
                "$or": [{"_id": req_bed_id}, {"id": req_bed_id}, {"_id": str(req_bed_id)}, {"id": str(req_bed_id)}],
                "$and": [{"$or": [{"ward_id": req_ward_id}, {"ward_id": str(req_ward_id)}]}],
                "is_active": active_filter(),
            })
            if not bed:
                raise HTTPException(status_code=404, detail="Selected bed not found or does not belong to the selected ward.")

            actual_bed_id = bed.get("_id") if bed.get("_id") is not None else req_bed_id
            patient_id_int = int(patient.get("id") or patient.get("_id"))

            # 4. Atomic bed allocation with safe concurrency control:
            allocation_res = mongo_db.beds.update_one(
                {
                    "_id": actual_bed_id,
                    "is_active": active_filter(),
                    "$or": [
                        {"is_occupied": {"$in": [False, 0]}},
                        {"occupied_by_patient_id": patient_id_int},
                    ],
                },
                {
                    "$set": {
                        "is_occupied": 1,
                        "occupied_by_patient_id": patient_id_int,
                        "updated_at": now,
                    }
                },
            )
            if allocation_res.matched_count == 0:
                raise HTTPException(
                    status_code=409,
                    detail="Selected bed is already occupied by another patient.",
                )

            allocated_bed_id = actual_bed_id
            prev_bed_id = patient.get("bed_id")

            # 5. Release previous bed if patient was assigned elsewhere
            if prev_bed_id and int(prev_bed_id) != req_bed_id:
                mongo_db.beds.update_one(
                    {"$or": [{"_id": int(prev_bed_id)}, {"id": int(prev_bed_id)}, {"_id": str(prev_bed_id)}]},
                    {"$set": {"is_occupied": 0, "occupied_by_patient_id": None, "updated_at": now}}
                )

            # 6. Update patient record
            mongo_db.patients.update_one(
                {"_id": patient_id_int},
                {
                    "$set": {
                        "ward_id": req_ward_id,
                        "bed_id": req_bed_id,
                        "is_admitted": True,
                        "admission_date": patient.get("admission_date") or now,
                        "updated_at": now,
                    }
                },
            )

            # 7. Update active encounter
            mongo_db.encounters.update_many(
                {"patient_id": patient_id_int, "status": "ACTIVE"},
                {
                    "$set": {
                        "ward_id": req_ward_id,
                        "bed_id": req_bed_id,
                        "encounter_type": "INPATIENT",
                        "updated_at": now,
                    }
                },
            )
            bed_info = {
                "ward_id": req_ward_id,
                "bed_id": req_bed_id,
                "ward_name": ward.get("name"),
                "bed_number": bed.get("bed_number"),
            }

            # 8. Create or update nurse-patient assignment
            if req_nurse_id and nurse_user:
                prev_active_assignment = mongo_db.nurse_patient_assignments.find_one({
                    "patient_id": patient_id_int,
                    "is_active": {"$in": [1, True]},
                })

                if prev_active_assignment:
                    if prev_active_assignment.get("nurse_id") == req_nurse_id:
                        # Already assigned to this exact nurse
                        pass
                    else:
                        deactivated_prev_assignment_id = prev_active_assignment["_id"]
                        mongo_db.nurse_patient_assignments.update_one(
                            {"_id": prev_active_assignment["_id"]},
                            {"$set": {
                                "is_active": False,
                                "ended_at": now,
                                "updated_at": now,
                            }}
                        )
                        reactivate_doc = mongo_db.nurse_patient_assignments.find_one({
                            "nurse_id": req_nurse_id,
                            "patient_id": patient_id_int,
                        })
                        if reactivate_doc:
                            mongo_db.nurse_patient_assignments.update_one(
                                {"_id": reactivate_doc["_id"]},
                                {"$set": {
                                    "is_active": True,
                                    "assigned_at": now,
                                    "assigned_by": current_user.id,
                                    "updated_at": now,
                                }}
                            )
                        else:
                            assign_id = next_mongo_id("nurse_patient_assignments")
                            new_assignment_created_id = assign_id
                            mongo_db.nurse_patient_assignments.insert_one({
                                "_id": assign_id,
                                "id": assign_id,
                                "nurse_id": req_nurse_id,
                                "patient_id": patient_id_int,
                                "assigned_at": now,
                                "assigned_by": current_user.id,
                                "is_active": True,
                                "created_at": now,
                                "updated_at": now,
                            })
                else:
                    reactivate_doc = mongo_db.nurse_patient_assignments.find_one({
                        "nurse_id": req_nurse_id,
                        "patient_id": patient_id_int,
                    })
                    if reactivate_doc:
                        mongo_db.nurse_patient_assignments.update_one(
                            {"_id": reactivate_doc["_id"]},
                            {"$set": {
                                "is_active": True,
                                "assigned_at": now,
                                "assigned_by": current_user.id,
                                "updated_at": now,
                            }}
                        )
                    else:
                        assign_id = next_mongo_id("nurse_patient_assignments")
                        new_assignment_created_id = assign_id
                        mongo_db.nurse_patient_assignments.insert_one({
                            "_id": assign_id,
                            "id": assign_id,
                            "nurse_id": req_nurse_id,
                            "patient_id": patient_id_int,
                            "assigned_at": now,
                            "assigned_by": current_user.id,
                            "is_active": True,
                            "created_at": now,
                            "updated_at": now,
                        })

                nurse_info = {
                    "nurse_id": req_nurse_id,
                    "nurse_name": nurse_user.get("full_name") or nurse_user.get("username") or f"Nurse #{req_nurse_id}",
                    "username": nurse_user.get("username"),
                }

        # If replacing an existing active prescription, supersede old prescription and cancel unadministered future schedules
        if replaced_rx:
            old_rx_id = int(replaced_rx.get("id") or replaced_rx.get("_id"))
            mongo_db.prescriptions.update_one(
                {"_id": old_rx_id},
                {"$set": {
                    "status": "SUPERSEDED",
                    "superseded_by": prescription_id,
                    "updated_at": now,
                }}
            )
            old_items = list(mongo_db.prescription_items.find({"prescription_id": old_rx_id}))
            for o_item in old_items:
                mongo_db.prescription_items.update_one(
                    {"_id": o_item["id"]},
                    {"$set": {
                        "status": "SUPERSEDED",
                        "updated_at": now,
                    }}
                )
                remove_unadministered_schedules(o_item["id"])

    except HTTPException:
        if new_assignment_created_id:
            mongo_db.nurse_patient_assignments.delete_one({"_id": new_assignment_created_id})
        if deactivated_prev_assignment_id:
            mongo_db.nurse_patient_assignments.update_one({"_id": deactivated_prev_assignment_id}, {"$set": {"is_active": True}})
        if allocated_bed_id:
            mongo_db.beds.update_one({"_id": allocated_bed_id}, {"$set": {"is_occupied": 0, "occupied_by_patient_id": None}})
            if prev_bed_id:
                mongo_db.beds.update_one({"$or": [{"_id": int(prev_bed_id)}, {"id": int(prev_bed_id)}]}, {"$set": {"is_occupied": 1, "occupied_by_patient_id": patient_id_int}})
        if created_schedule_ids:
            mongo_db.medication_schedules.delete_many({"_id": {"$in": created_schedule_ids}})
            mongo_db.medication_notifications.delete_many({"medication_schedule_id": {"$in": created_schedule_ids}})
        if created_item_ids:
            mongo_db.prescription_items.delete_many({"_id": {"$in": created_item_ids}})
        mongo_db.prescriptions.delete_one({"_id": prescription_id})
        raise
    except Exception as exc:
        if new_assignment_created_id:
            mongo_db.nurse_patient_assignments.delete_one({"_id": new_assignment_created_id})
        if deactivated_prev_assignment_id:
            mongo_db.nurse_patient_assignments.update_one({"_id": deactivated_prev_assignment_id}, {"$set": {"is_active": True}})
        if allocated_bed_id:
            mongo_db.beds.update_one({"_id": allocated_bed_id}, {"$set": {"is_occupied": 0, "occupied_by_patient_id": None}})
            if prev_bed_id:
                mongo_db.beds.update_one({"$or": [{"_id": int(prev_bed_id)}, {"id": int(prev_bed_id)}]}, {"$set": {"is_occupied": 1, "occupied_by_patient_id": patient_id_int}})
        if created_schedule_ids:
            mongo_db.medication_schedules.delete_many({"_id": {"$in": created_schedule_ids}})
            mongo_db.medication_notifications.delete_many({"medication_schedule_id": {"$in": created_schedule_ids}})
        if created_item_ids:
            mongo_db.prescription_items.delete_many({"_id": {"$in": created_item_ids}})
        mongo_db.prescriptions.delete_one({"_id": prescription_id})
        raise HTTPException(
            status_code=500,
            detail=f"Prescription creation failed: {str(exc)}",
        ) from exc

    first_item = created_items_summary[0] if created_items_summary else {}
    return {
        "message": f"Prescription created successfully with {len(created_items_summary)} medicine(s).",
        "prescription_id": prescription_id,
        "patient_id": patient["id"],
        "doctor_id": current_user.id,
        "medicine_count": len(created_items_summary),
        "medicines": created_items_summary,
        "schedule_count": len(created_schedule_ids),
        "bed_assignment": bed_info,
        "nurse_assignment": nurse_info,
        "prescription_id": prescription_id,
        "patient_id": patient["id"],
        "doctor_id": current_user.id,
        "medicine_count": len(created_items_summary),
        "medicines": created_items_summary,
        "schedule_count": len(created_schedule_ids),
        "bed_assignment": bed_info,
        # Legacy fields for backward compatibility
        "prescription_item_id": first_item.get("id"),
        "medicine_id": first_item.get("medicine_id"),
        "medicine_name": first_item.get("medicine_name"),
        "dose": first_item.get("dose"),
        "route": first_item.get("route"),
        "frequency": first_item.get("frequency"),
        "duration_days": first_item.get("duration_days"),
        "start_date": first_item.get("start_date"),
        "start_time": first_item.get("start_time"),
        "is_stat": first_item.get("is_stat", False),
        "replaces_prescription_id": prescription.get("replaces_prescription_id"),
    }


# =========================================================
# REPLACE PRESCRIPTION
# =========================================================

@router.post("/prescriptions/{prescription_id}/replace")
def replace_prescription(
    prescription_id: int,
    request: PrescriptionCreate,
    current_user=Depends(
        require_permission("CREATE_PRESCRIPTION")
    ),
):
    request.replaces_prescription_id = prescription_id
    return create_prescription(request=request, current_user=current_user)


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
        "$or": [{"_id": prescription_id}, {"id": prescription_id}]
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

    actual_rx_id = int(prescription.get("id") or prescription.get("_id"))
    now = mongo_now()

    mongo_db.prescriptions.update_one(
        {"_id": actual_rx_id},
        {"$set": {
            "status": "STOPPED",
            "updated_at": now,
        }},
    )

    items = list(
        mongo_db.prescription_items.find({
            "prescription_id": actual_rx_id
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
        "prescription_id": actual_rx_id,
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
    patient_id: str,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    patient = get_doctor_patient_history_or_404(
        patient_id,
        current_user,
    )

    actual_patient_id = int(patient.get("id", patient.get("_id")))
    patient_str_id = patient.get("patient_id")
    target_ids = [actual_patient_id, str(actual_patient_id)]
    if patient_str_id:
        target_ids.append(patient_str_id)

    prescriptions = list(
        mongo_db.prescriptions.find({
            "patient_id": {"$in": target_ids}
        }).sort("created_at", -1)
    )

    doctor_cache = {}
    result = []

    for prescription in prescriptions:
        rx_id = int(prescription.get("id") or prescription.get("_id"))
        doc_id = prescription.get("doctor_id")

        if doc_id not in doctor_cache:
            doc_user = mongo_db.users.find_one({"$or": [{"_id": doc_id}, {"id": doc_id}]})
            if doc_user:
                full_name = doc_user.get("full_name") or doc_user.get("username")
                doctor_cache[doc_id] = f"Dr. {full_name}" if full_name and not str(full_name).startswith("Dr.") else (full_name or f"Dr. #{doc_id}")
            else:
                doctor_cache[doc_id] = f"Dr. #{doc_id}"

        doctor_name = doctor_cache[doc_id]

        items = list(
            mongo_db.prescription_items.find({
                "prescription_id": rx_id
            }).sort("id", 1)
        )

        formatted_items = []
        for item in items:
            medicine = mongo_db.medicines.find_one({
                "$or": [{"_id": item["medicine_id"]}, {"id": item["medicine_id"]}]
            })

            med_name = medicine.get("name") if medicine else (item.get("medicine_name") or f"Medicine #{item.get('medicine_id')}")
            gen_name = medicine.get("generic_name") if medicine else None
            strength = medicine.get("strength") if medicine else None
            dosage_form = medicine.get("dosage_form") if medicine else None

            item_dict = {
                "id": item["id"],
                "prescription_item_id": item["id"],
                "prescription_id": rx_id,
                "medicine_id": item["medicine_id"],
                "medicine_name": med_name,
                "generic_name": gen_name,
                "strength": strength,
                "dosage_form": dosage_form,
                "dose": item.get("dose") or "",
                "dosage": item.get("dose") or "",
                "route": item.get("route") or "Oral",
                "frequency": item.get("frequency") or "ONCE_DAILY",
                "duration_days": int(item.get("duration_days") or 1),
                "start_date": str(item.get("start_date") or ""),
                "start_time": str(item.get("start_time") or "08:00"),
                "administration_times": item.get("administration_times") or [],
                "is_stat": mongo_bool(item.get("is_stat")),
                "instructions": item.get("instructions"),
                "status": item.get("status", "ACTIVE"),
                "item_status": item.get("status", "ACTIVE"),
            }
            formatted_items.append(item_dict)

        first_item = formatted_items[0] if formatted_items else {}
        rx_status = str(prescription.get("status") or "ACTIVE").upper()

        rx_record = {
            "id": rx_id,
            "prescription_id": rx_id,
            "patient_id": actual_patient_id,
            "doctor_id": doc_id,
            "doctor_name": doctor_name,
            "status": rx_status,
            "prescription_status": rx_status,
            "is_active": rx_status == "ACTIVE",
            "notes": prescription.get("notes"),
            "prescription_notes": prescription.get("notes"),
            "replaces_prescription_id": prescription.get("replaces_prescription_id"),
            "superseded_by": prescription.get("superseded_by"),
            "items": formatted_items,
            # Top-level flat compatibility fields
            "prescription_item_id": first_item.get("id"),
            "medicine_id": first_item.get("medicine_id"),
            "medicine_name": first_item.get("medicine_name"),
            "generic_name": first_item.get("generic_name"),
            "strength": first_item.get("strength"),
            "dosage_form": first_item.get("dosage_form"),
            "dose": first_item.get("dose"),
            "dosage": first_item.get("dosage"),
            "route": first_item.get("route"),
            "frequency": first_item.get("frequency"),
            "duration_days": first_item.get("duration_days"),
            "start_date": first_item.get("start_date"),
            "start_time": first_item.get("start_time"),
            "is_stat": first_item.get("is_stat", False),
            "instructions": first_item.get("instructions"),
            "item_status": first_item.get("item_status"),
            "created_at": prescription.get("created_at"),
            "updated_at": prescription.get("updated_at"),
        }
        result.append(rx_record)

    return result


# =========================================================
# DOCTOR ON-ROUND SYSTEM
# =========================================================

@router.post("/rounds/verify-qr")
def doctor_verify_round_qr(
    request: RoundVerifyQRRequest,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    Verify a patient wristband QR during doctor ward rounds.
    Confirms patient identity, bed allocation, and assigned encounter.
    """
    token = request.qr_token.strip()
    if not token:
        return {"valid": False, "message": "QR token is required."}

    patient = mongo_db.patients.find_one({
        "qr_token": token,
        "qr_is_active": active_filter(),
        "is_active": active_filter(),
    })

    if not patient:
        return {
            "valid": False,
            "message": "Invalid or inactive patient wristband QR. Ensure patient is currently admitted.",
        }

    p_id = int(patient.get("id", patient.get("_id")))

    # Verify patient has an active encounter assigned to this doctor
    encounter = mongo_db.encounters.find_one({
        "patient_id": p_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if not encounter:
        return {
            "valid": False,
            "patient_id": p_id,
            "message": f"Patient #{patient.get('patient_id')} is not assigned to your clinical roster.",
        }

    # Fetch ward and bed details
    ward_name = None
    bed_number = None
    if patient.get("ward_id"):
        ward = mongo_db.wards.find_one({"_id": patient["ward_id"]})
        if ward:
            ward_name = ward.get("name")
    if patient.get("bed_id"):
        bed = mongo_db.beds.find_one({"_id": patient["bed_id"]})
        if bed:
            bed_number = bed.get("bed_number")

    # Allergies
    allergies = list(mongo_db.patient_allergies.find({"patient_id": p_id}))
    for a in allergies:
        a["id"] = a.get("id", a.get("_id"))
        if "_id" in a:
            del a["_id"]

    # Active Prescriptions
    active_rx = list(mongo_db.prescriptions.find({"patient_id": p_id, "status": "ACTIVE"}))
    rx_items = []
    for rx in active_rx:
        rx_id = rx.get("id", rx.get("_id"))
        items = list(mongo_db.prescription_items.find({"prescription_id": rx_id, "status": "ACTIVE"}))
        for it in items:
            med = mongo_db.medicines.find_one({"_id": it.get("medicine_id")})
            rx_items.append({
                "prescription_id": rx_id,
                "medicine_name": med.get("name") if med else "Unknown",
                "dose": it.get("dose"),
                "route": it.get("route"),
                "frequency": it.get("frequency"),
                "instructions": it.get("instructions"),
                "is_stat": it.get("is_stat", False),
            })

    # Upcoming medication schedules
    active_items_ids = [it.get("id", it.get("_id")) for it in mongo_db.prescription_items.find({"prescription_id": {"$in": [r.get("id", r.get("_id")) for r in active_rx]}})]
    schedules = list(mongo_db.medication_schedules.find({
        "prescription_item_id": {"$in": active_items_ids},
        "status": {"$in": ["UPCOMING", "SCHEDULED", "DUE", "PENDING"]},
    }).sort([("scheduled_date", 1), ("scheduled_time", 1)]).limit(5))
    for s in schedules:
        s["id"] = s.get("id", s.get("_id"))
        if "_id" in s:
            del s["_id"]

    # Past assessments
    past_assessments = list(mongo_db.patient_round_assessments.find({
        "patient_id": p_id,
    }).sort("created_at", 1))
    for pa in past_assessments:
        pa["id"] = pa.get("id", pa.get("_id"))
        if "_id" in pa:
            del pa["_id"]

    last_assessment = past_assessments[-1] if past_assessments else None

    first = patient.get("first_name", "")
    last = patient.get("last_name", "")
    full_name = f"{first} {last}".strip() or "Inpatient"

    return {
        "valid": True,
        "message": "Patient wristband verified successfully. Active encounter confirmed for doctor rounds.",
        "patient": {
            "id": p_id,
            "patient_id": patient.get("patient_id"),
            "full_name": full_name,
            "gender": patient.get("gender"),
            "date_of_birth": patient.get("date_of_birth"),
            "weight_kg": patient.get("weight_kg"),
            "ward_id": patient.get("ward_id"),
            "ward_name": ward_name,
            "bed_id": patient.get("bed_id"),
            "bed_number": bed_number,
            "admission_date": patient.get("admission_date") or encounter.get("admitted_at"),
            "chief_complaint": encounter.get("chief_complaint"),
            "symptom_duration": encounter.get("symptom_duration"),
            "symptom_severity": encounter.get("symptom_severity"),
            "allergies": allergies,
            "active_prescriptions": rx_items,
            "upcoming_schedules": schedules,
            "past_assessments": past_assessments,
            "last_assessment": last_assessment,
        }
    }


@router.get("/rounds/patients")
def get_doctor_round_patients(
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    List all active inpatients assigned to the doctor with their
    latest recovery assessment and bed allocation for ward rounds.
    """
    patient_ids = mongo_db.encounters.distinct(
        "patient_id",
        {
            "doctor_id": current_user.id,
            "status": "ACTIVE",
        },
    )

    if not patient_ids:
        return []

    patients = list(mongo_db.patients.find({
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }).sort([("last_name", 1), ("first_name", 1)]))

    results = []
    for p in patients:
        p_id = int(p.get("id", p.get("_id")))
        enc = mongo_db.encounters.find_one({
            "patient_id": p_id,
            "doctor_id": current_user.id,
            "status": "ACTIVE",
        })

        ward_name = None
        bed_number = None
        if p.get("ward_id"):
            w = mongo_db.wards.find_one({"_id": p["ward_id"]})
            if w:
                ward_name = w.get("name")
        if p.get("bed_id"):
            b = mongo_db.beds.find_one({"_id": p["bed_id"]})
            if b:
                bed_number = b.get("bed_number")

        assessments = list(mongo_db.patient_round_assessments.find({
            "patient_id": p_id,
        }).sort("created_at", -1).limit(1))

        last_assessment = None
        if assessments:
            la = assessments[0]
            last_assessment = {
                "id": la.get("id", la.get("_id")),
                "improvement_percentage": la.get("improvement_percentage"),
                "clinical_notes": la.get("clinical_notes"),
                "doctor_name": la.get("doctor_name"),
                "created_at": la.get("created_at"),
            }

        total_assessments = mongo_db.patient_round_assessments.count_documents({
            "patient_id": p_id,
        })

        first = p.get("first_name", "")
        last = p.get("last_name", "")
        full_name = f"{first} {last}".strip() or "Inpatient"

        results.append({
            "id": p_id,
            "patient_id": p.get("patient_id"),
            "full_name": full_name,
            "gender": p.get("gender"),
            "date_of_birth": p.get("date_of_birth"),
            "ward_id": p.get("ward_id"),
            "ward_name": ward_name,
            "bed_id": p.get("bed_id"),
            "bed_number": bed_number,
            "admitted_at": enc.get("admitted_at") if enc else p.get("admission_date"),
            "chief_complaint": enc.get("chief_complaint") if enc else None,
            "last_assessment": last_assessment,
            "assessment_count": total_assessments,
            "qr_token": p.get("qr_token"),
        })

    return results


@router.post("/rounds/assessments")
def create_round_assessment(
    request: RoundAssessmentCreate,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    Record a bedside recovery assessment (0-100% improvement, clinical notes,
    timestamp and doctor ID) during ward rounds.
    """
    p_id = request.patient_id

    patient = mongo_db.patients.find_one({
        "_id": p_id,
        "is_active": active_filter(),
    })
    if not patient:
        raise HTTPException(status_code=404, detail="Active patient not found.")

    encounter = mongo_db.encounters.find_one({
        "patient_id": p_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })
    if not encounter:
        raise HTTPException(
            status_code=403,
            detail="Patient is not assigned to your active clinical roster.",
        )

    now = mongo_now()
    assessment_id = next_mongo_id("patient_round_assessments")

    doc = {
        "_id": assessment_id,
        "id": assessment_id,
        "patient_id": p_id,
        "encounter_id": encounter.get("id", encounter.get("_id")),
        "doctor_id": current_user.id,
        "doctor_name": getattr(current_user, "full_name", None) or getattr(current_user, "username", "Attending Doctor"),
        "improvement_percentage": int(request.improvement_percentage),
        "clinical_notes": (request.clinical_notes or "").strip() or None,
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.patient_round_assessments.insert_one(doc)

    return {
        "message": "Patient recovery assessment saved successfully.",
        "assessment": {
            "id": assessment_id,
            "patient_id": p_id,
            "doctor_id": current_user.id,
            "doctor_name": doc["doctor_name"],
            "improvement_percentage": doc["improvement_percentage"],
            "clinical_notes": doc["clinical_notes"],
            "created_at": now,
        }
    }


@router.get("/patients/{patient_id}/assessments")
def get_patient_round_assessments(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    Retrieve historical recovery assessments for a patient sorted chronologically.
    Allows viewing progress across rounds, even after discharge.
    """
    get_doctor_patient_history_or_404(patient_id, current_user)

    assessments = list(mongo_db.patient_round_assessments.find({
        "patient_id": patient_id,
    }).sort("created_at", 1))

    results = []
    for a in assessments:
        results.append({
            "id": a.get("id", a.get("_id")),
            "patient_id": a.get("patient_id"),
            "encounter_id": a.get("encounter_id"),
            "doctor_id": a.get("doctor_id"),
            "doctor_name": a.get("doctor_name"),
            "improvement_percentage": a.get("improvement_percentage"),
            "clinical_notes": a.get("clinical_notes"),
            "created_at": a.get("created_at"),
        })

    return results


# =========================================================
# HOSPITAL WARDS & BEDS FOR INPATIENT ADMISSION
# =========================================================

def _natural_bed_key(text):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', str(text))]


@router.get("/wards")
def get_doctor_wards(
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    List all active hospital wards with real-time bed occupancy stats
    for doctor inpatient admission and bed allocation.
    """
    wards = list(
        mongo_db.wards.find({
            "is_active": active_filter(),
        }).sort("name", 1)
    )

    result = []
    for ward in wards:
        ward_id = ward.get("id") if ward.get("id") is not None else ward.get("_id")
        bed_query = {
            "$or": [{"ward_id": ward_id}, {"ward_id": str(ward_id)}],
            "is_active": active_filter(),
        }
        total = mongo_db.beds.count_documents(bed_query)
        occupied = mongo_db.beds.count_documents({
            **bed_query,
            "is_occupied": active_filter(),
        })

        result.append({
            "id": ward_id,
            "_id": ward_id,
            "name": ward.get("name"),
            "code": ward.get("code"),
            "description": ward.get("description"),
            "total_beds": total,
            "occupied_beds": occupied,
            "available_beds": max(0, total - occupied),
        })

    return {
        "count": len(result),
        "wards": result,
    }


@router.get("/wards/{ward_id}/beds")
def get_doctor_ward_beds(
    ward_id: int,
    patient_id: Optional[str] = Query(None, description="Optional patient ID to include current bed"),
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    """
    List beds for a specific ward.
    Returns genuinely available/unoccupied beds. If patient_id is provided,
    includes the bed currently assigned to this patient.
    """
    ward = mongo_db.wards.find_one({
        "$or": [
            {"_id": ward_id},
            {"id": ward_id},
            {"_id": str(ward_id)},
            {"id": str(ward_id)},
        ],
        "is_active": active_filter(),
    })
    if not ward:
        raise HTTPException(status_code=404, detail="Selected hospital ward not found or inactive.")

    beds = list(
        mongo_db.beds.find({
            "$or": [{"ward_id": ward_id}, {"ward_id": str(ward_id)}],
            "is_active": active_filter(),
        })
    )

    # Natural sorting for bed numbers (e.g. IC-1, IC-2, IC-10, Bed 1, Bed 2)
    beds.sort(key=lambda b: _natural_bed_key(b.get("bed_number", "")))

    parsed_pid = None
    if patient_id is not None and str(patient_id).strip().lower() not in ("", "null", "undefined", "none"):
        try:
            parsed_pid = int(patient_id)
        except (ValueError, TypeError):
            parsed_pid = str(patient_id).strip()

    bed_list = []
    for bed in beds:
        b_id = bed.get("id") if bed.get("id") is not None else bed.get("_id")
        is_occ = mongo_bool(bed.get("is_occupied"))
        occ_pid = bed.get("occupied_by_patient_id")

        # Determine if this bed is available for allocation
        is_avail = not is_occ
        if parsed_pid is not None and occ_pid is not None and str(occ_pid) == str(parsed_pid):
            is_avail = True

        bed_list.append({
            "id": b_id,
            "_id": b_id,
            "bed_number": bed.get("bed_number") or str(b_id),
            "ward_id": ward_id,
            "is_active": mongo_bool(bed.get("is_active")),
            "is_occupied": is_occ,
            "occupied_by_patient_id": occ_pid,
            "is_available": is_avail,
            "status": "OCCUPIED" if is_occ else "AVAILABLE",
        })

    occupied_count = sum(1 for b in bed_list if b["is_occupied"])
    available_count = sum(1 for b in bed_list if b["is_available"])

    ward_actual_id = ward.get("id") if ward.get("id") is not None else ward.get("_id")

    return {
        "ward": {
            "id": ward_actual_id,
            "name": ward.get("name"),
            "code": ward.get("code"),
            "description": ward.get("description"),
        },
        "beds": bed_list,
        "counts": {
            "total": len(bed_list),
            "occupied": occupied_count,
            "available": available_count,
        },
    }
