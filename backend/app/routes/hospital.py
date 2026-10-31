
from datetime import date, datetime
from secrets import token_urlsafe
import re

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.mongo_client import mongo_db
from app.security import get_current_user, require_permission


router = APIRouter(
    prefix="/api/hospital",
    tags=["Hospital Portal"],
)


# =====================================================
# HELPERS
# =====================================================

def now_string():
    return datetime.utcnow().isoformat(timespec="microseconds")


def as_bool(value):
    return value is True or value == 1 or str(value).lower() in (
        "true", "1", "yes"
    )


def parse_date_of_birth(value):
    if value is None or str(value).strip() == "":
        return None

    try:
        return date.fromisoformat(str(value).strip()).isoformat()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date_of_birth. Use YYYY-MM-DD."
        )


def parse_weight(value):
    if value is None or str(value).strip() == "":
        return None

    try:
        weight = float(value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="weight_kg must be a valid number."
        )

    if weight <= 0 or weight > 500:
        raise HTTPException(
            status_code=400,
            detail="weight_kg must be between 0 and 500."
        )

    return weight


def parse_boolean(value, default=True):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    value = str(value).strip().lower()

    if value in {"true", "1", "yes", "y", "active"}:
        return True

    if value in {"false", "0", "no", "n", "inactive"}:
        return False

    raise HTTPException(
        status_code=400,
        detail="Invalid boolean value."
    )


def next_numeric_id(collection_name):
    """
    Allocate a new numeric ID safely using MongoDB counters.
    Existing SQLite IDs remain unchanged.
    """
    collection = mongo_db[collection_name]

    latest = collection.find_one(
        {},
        sort=[("_id", -1)],
        projection={"_id": 1}
    )

    maximum = int(latest["_id"]) if latest and (isinstance(latest.get("_id"), int) or (isinstance(latest.get("_id"), str) and str(latest.get("_id")).isdigit())) else 0

    counters = mongo_db["_id_sequences"]

    counters.update_one(
        {"_id": collection_name},
        {"$setOnInsert": {"value": maximum}},
        upsert=True
    )

    counters.update_one(
        {"_id": collection_name},
        {"$max": {"value": maximum}}
    )

    result = counters.find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"value": 1}},
        return_document=ReturnDocument.AFTER
    )

    return int(result["value"])


def ensure_patient_indexes():
    mongo_db.patients.create_index(
        [("patient_id", 1)],
        unique=True,
        name="uq_patients_patient_id"
    )

    mongo_db.patients.create_index(
        [("qr_token", 1)],
        unique=True,
        name="uq_patients_qr_token",
        partialFilterExpression={
            "qr_token": {"$type": "string"}
        }
    )


def generate_patient_id():
    today = date.today()
    prefix = f"SMH-PUN-{today.strftime('%y%m%d')}-"

    last_patient = mongo_db.patients.find_one(
        {
            "patient_id": {
                "$regex": "^" + re.escape(prefix)
            }
        },
        sort=[("patient_id", -1)]
    )

    sequence = 1

    if last_patient:
        try:
            sequence = (
                int(last_patient["patient_id"].split("-")[-1]) + 1
            )
        except (ValueError, IndexError, KeyError):
            raise HTTPException(
                status_code=500,
                detail="Unable to generate patient ID."
            )

    return f"{prefix}{sequence:04d}"


def generate_patient_qr_token():
    return token_urlsafe(32)


def optional_text(request, field, max_length=None):
    value = request.get(field)

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    if max_length and len(value) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field} cannot exceed {max_length} characters."
        )

    return value


def patient_to_dict(patient):
    return {
        "id": patient["id"],
        "patient_id": patient["patient_id"],
        "first_name": patient.get("first_name"),
        "last_name": patient.get("last_name"),
        "full_name": (
            f"{patient.get('first_name', '')} "
            f"{patient.get('last_name', '')}"
        ).strip(),
        "date_of_birth": patient.get("date_of_birth"),
        "gender": patient.get("gender"),
        "weight_kg": patient.get("weight_kg"),
        "mobile_number": patient.get("mobile_number"),
        "email": patient.get("email"),
        "address": patient.get("address"),
        "emergency_contact_name": patient.get(
            "emergency_contact_name"
        ),
        "emergency_contact_number": patient.get(
            "emergency_contact_number"
        ),
        "emergency_contact_relationship": patient.get(
            "emergency_contact_relationship"
        ),
        "preferred_language": patient.get("preferred_language"),
        "ward_id": patient.get("ward_id"),
        "bed_id": patient.get("bed_id"),
        "is_active": as_bool(patient.get("is_active")),
        "lifecycle_status": patient.get("lifecycle_status", "ACTIVE" if as_bool(patient.get("is_active")) else "DISCHARGED"),
        "qr_is_active": as_bool(patient.get("qr_is_active")),
        "qr_generated_at": patient.get("qr_generated_at"),
        "created_at": patient.get("created_at"),
        "updated_at": patient.get("updated_at"),
    }


# =====================================================
# HOSPITAL DASHBOARD
# =====================================================

@router.get("/dashboard")
def get_hospital_dashboard(
    current_user=Depends(require_permission("VIEW_PATIENT"))
):
    active_query = {
        "is_active": {"$in": [True, 1]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }
    active = mongo_db.patients.count_documents(active_query)

    return {
        "message": "Hospital dashboard generated successfully.",
        "hospital": {
            "portal": "Hospital Data Portal",
            "status": "ACTIVE",
        },
        "patients": {
            "total": active,
            "active": active,
            "inactive": 0,
        },
    }


# =====================================================
# LIST / SEARCH PATIENTS
# =====================================================

@router.get("/patients")
def get_hospital_patients(
    search: str | None = None,
    active_only: bool = True,
    limit: int = 100,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    limit = max(1, min(limit, 500))

    query = {
        "is_active": {"$in": [True, 1]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }

    if search and search.strip():
        pattern = re.escape(search.strip())

        query["$or"] = [
            {"patient_id": {"$regex": pattern, "$options": "i"}},
            {"first_name": {"$regex": pattern, "$options": "i"}},
            {"last_name": {"$regex": pattern, "$options": "i"}},
        ]

    patients = list(
        mongo_db.patients.find(query)
        .sort("_id", -1)
        .limit(limit)
    )

    return {
        "count": len(patients),
        "patients": [
            patient_to_dict(patient)
            for patient in patients
        ],
    }


# =====================================================
# COMPLETE PATIENT PROFILE
# =====================================================

@router.get("/patients/{patient_id}")
def get_hospital_patient(
    patient_id: int,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    patient = mongo_db.patients.find_one({"_id": patient_id})

    if patient is None:
        raise HTTPException(404, "Patient not found.")

    encounter = mongo_db.encounters.find_one(
        {"patient_id": patient_id},
        sort=[("created_at", -1), ("_id", -1)]
    )

    doctor = None
    ward = None
    bed = None
    billing = None

    if encounter and encounter.get("doctor_id") is not None:
        doctor = mongo_db.users.find_one({
            "_id": encounter["doctor_id"]
        })

    if patient.get("ward_id") is not None:
        ward = mongo_db.wards.find_one({
            "_id": patient["ward_id"]
        })

    if patient.get("bed_id") is not None:
        bed = mongo_db.beds.find_one({
            "_id": patient["bed_id"]
        })

    billing = mongo_db.patient_billing.find_one(
        {"patient_id": patient_id},
        sort=[("created_at", -1), ("_id", -1)]
    )

    doctor_name = (
        doctor.get("full_name")
        if doctor
        else None
    )

    result = patient_to_dict(patient)

    result.update({
        "ward": (
            {
                "id": ward["id"],
                "name": ward.get("name"),
                "code": ward.get("code"),
                "description": ward.get("description"),
                "is_active": as_bool(ward.get("is_active")),
            }
            if ward else None
        ),

        "bed": (
            {
                "id": bed["id"],
                "bed_number": bed.get("bed_number"),
                "ward_id": bed.get("ward_id"),
                "is_active": as_bool(bed.get("is_active")),
                "is_occupied": as_bool(bed.get("is_occupied")),
            }
            if bed else None
        ),

        "encounter": (
            {
                "id": encounter["id"],
                "doctor_id": encounter.get("doctor_id"),
                "doctor_name": doctor_name,
                "encounter_type": encounter.get("encounter_type"),
                "status": encounter.get("status"),
                "admitted_at": encounter.get("admitted_at"),
                "discharged_at": encounter.get("discharged_at"),
                "discharge_reason": encounter.get("discharge_reason"),
                "chief_complaint": encounter.get("chief_complaint"),
                "symptom_duration": encounter.get("symptom_duration"),
                "symptom_severity": encounter.get("symptom_severity"),
                "visit_notes": encounter.get("visit_notes"),
                "medical_history_notes": encounter.get(
                    "medical_history_notes"
                ),
                "current_medication_notes": encounter.get(
                    "current_medication_notes"
                ),
                "allergy_notes": encounter.get("allergy_notes"),
                "clinical_observations": encounter.get(
                    "clinical_observations"
                ),
            }
            if encounter else None
        ),

        "doctor": (
            {
                "id": doctor["id"],
                "full_name": doctor.get("full_name"),
                "username": doctor.get("username"),
                "email": doctor.get("email"),
            }
            if doctor else None
        ),

        "billing": (
            {
                "id": billing["id"],
                "bill_status": billing.get("bill_status"),
                "bill_amount": billing.get("bill_amount"),
                "paid_at": billing.get("paid_at"),
                "paid_by": billing.get("paid_by"),
                "created_at": billing.get("created_at"),
                "updated_at": billing.get("updated_at"),
            }
            if billing else None
        ),
    })

    return {"patient": result}


# =====================================================
# ACTIVE DOCTORS
# =====================================================

@router.get("/doctors")
def get_hospital_doctors(
    current_user=Depends(require_permission("VIEW_PATIENT"))
):
    role = mongo_db.roles.find_one({"name": "Doctor"})

    if role is None:
        return {"count": 0, "doctors": []}

    doctors = list(
        mongo_db.users.find({
            "role_id": role["id"],
            "is_active": {"$in": [True, 1]},
        }).sort("full_name", 1)
    )

    return {
        "count": len(doctors),
        "doctors": [
            {
                "id": doctor["id"],
                "full_name": doctor.get("full_name"),
                "username": doctor.get("username"),
                "email": doctor.get("email"),
            }
            for doctor in doctors
        ],
    }


# =====================================================
# REGISTRATION PERMISSION
# =====================================================

def require_patient_registration_permission(
    current_user=Depends(get_current_user)
):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }

    if not (
        {"MANAGE_SYSTEM", "REGISTER_PATIENT", "CREATE_PRESCRIPTION", "VIEW_PATIENT"}
        & permission_names
    ):
        raise HTTPException(
            status_code=403,
            detail="Patient registration permission required."
        )

    return current_user


# =====================================================
# ACTIVE WARDS
# =====================================================

@router.get("/wards")
def get_registration_wards(
    current_user=Depends(
        require_patient_registration_permission
    )
):
    wards = list(
        mongo_db.wards.find({
            "is_active": {"$in": [True, 1]}
        }).sort("name", 1)
    )

    result = []

    for ward in wards:
        bed_query = {
            "ward_id": ward["id"],
            "is_active": {"$in": [True, 1]},
        }

        total = mongo_db.beds.count_documents(bed_query)

        occupied = mongo_db.beds.count_documents({
            **bed_query,
            "is_occupied": {"$in": [True, 1]},
        })

        result.append({
            "id": ward["id"],
            "name": ward.get("name"),
            "code": ward.get("code"),
            "description": ward.get("description"),
            "total_beds": total,
            "occupied_beds": occupied,
            "available_beds": total - occupied,
        })

    return {
        "wards": result,
        "count": len(result),
    }


# =====================================================
# WARD BEDS
# =====================================================

@router.get("/wards/{ward_id}/beds")
def get_registration_ward_beds(
    ward_id: int,
    current_user=Depends(
        require_patient_registration_permission
    )
):
    ward = mongo_db.wards.find_one({
        "_id": ward_id,
        "is_active": {"$in": [True, 1]},
    })

    if ward is None:
        raise HTTPException(404, "Ward not found.")

    beds = list(
        mongo_db.beds.find({
            "ward_id": ward_id,
            "is_active": {"$in": [True, 1]},
        }).sort("bed_number", 1)
    )

    bed_list = [
        {
            "id": bed["id"],
            "bed_number": bed.get("bed_number"),
            "ward_id": bed.get("ward_id"),
            "is_active": as_bool(bed.get("is_active")),
            "is_occupied": as_bool(bed.get("is_occupied")),
            "status": (
                "OCCUPIED"
                if as_bool(bed.get("is_occupied"))
                else "AVAILABLE"
            ),
        }
        for bed in beds
    ]

    occupied = sum(
        1 for bed in bed_list if bed["is_occupied"]
    )

    return {
        "ward": {
            "id": ward["id"],
            "name": ward.get("name"),
            "code": ward.get("code"),
        },
        "beds": bed_list,
        "counts": {
            "total": len(bed_list),
            "occupied": occupied,
            "available": len(bed_list) - occupied,
        },
    }


# =====================================================
# REGISTER PATIENT
# =====================================================

@router.post("/patients")
def create_hospital_patient(
    request: dict,
    current_user=Depends(
        require_patient_registration_permission
    ),
):
    # Support full_name shorthand
    if "full_name" in request and (not request.get("first_name") or not request.get("last_name")):
        raw_full = str(request["full_name"]).strip()
        parts = raw_full.split()
        if parts:
            request["first_name"] = parts[0]
            request["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else parts[0]

    # Support age shorthand for date_of_birth
    age_val = request.get("age")
    age_int = None
    if age_val is not None:
        try:
            age_int = int(age_val)
        except (ValueError, TypeError):
            pass

    if not request.get("date_of_birth") and age_int is not None:
        birth_year = date.today().year - age_int
        request["date_of_birth"] = f"{birth_year:04d}-01-01"

    required_fields = [
        "first_name",
        "last_name",
        "doctor_id",
    ]

    for field in required_fields:
        if (
            request.get(field) is None
            or str(request.get(field)).strip() == ""
        ):
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required."
            )

    first_name = str(request["first_name"]).strip()
    last_name = str(request["last_name"]).strip()

    gender = request.get("gender")
    gender = str(gender).strip() if gender else None

    dob = parse_date_of_birth(
        request.get("date_of_birth")
    )

    weight = parse_weight(
        request.get("weight_kg")
    )

    mobile = optional_text(request, "mobile_number", 25)
    email = optional_text(request, "email", 255)
    address = optional_text(request, "address")

    emergency_name = optional_text(
        request, "emergency_contact_name", 150
    )
    emergency_number = optional_text(
        request, "emergency_contact_number", 25
    )
    emergency_relationship = optional_text(
        request, "emergency_contact_relationship", 60
    )
    preferred_language = optional_text(
        request, "preferred_language", 60
    )

    chief_complaint = (
        optional_text(request, "chief_complaint")
        or optional_text(request, "problem_category")
    )

    symptom_duration = optional_text(
        request, "symptom_duration", 100
    )
    symptom_severity = optional_text(
        request, "symptom_severity", 30
    )
    visit_notes = optional_text(request, "visit_notes")
    medical_history_notes = optional_text(
        request, "medical_history_notes"
    )
    current_medication_notes = optional_text(
        request, "current_medication_notes"
    )
    allergy_notes = optional_text(request, "allergy_notes")

    clinical_observations = request.get(
        "clinical_observations"
    )

    if clinical_observations in ("", None, {}):
        clinical_observations = None
    elif not isinstance(clinical_observations, dict):
        raise HTTPException(
            status_code=400,
            detail="clinical_observations must be a JSON object."
        )

    try:
        doctor_id = int(request["doctor_id"])
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="doctor_id must be a valid integer."
        )

    doctor_role = mongo_db.roles.find_one({
        "name": "Doctor"
    })

    if doctor_role is None:
        raise HTTPException(
            status_code=400,
            detail="Doctor role is not configured."
        )

    doctor = mongo_db.users.find_one({
        "_id": doctor_id,
        "role_id": doctor_role["id"],
        "is_active": {"$in": [True, 1]},
    })

    if doctor is None:
        raise HTTPException(
            status_code=400,
            detail="Selected doctor is not an active registered doctor."
        )

    is_admitted = parse_boolean(
        request.get("is_admitted"),
        default=False
    )

    ward_id = request.get("ward_id")
    bed_id = request.get("bed_id")

    if ward_id in ("", None):
        ward_id = None

    if bed_id in ("", None):
        bed_id = None

    selected_bed = None

    if is_admitted:
        if ward_id is None or bed_id is None:
            raise HTTPException(
                status_code=400,
                detail="Ward and bed are required when admitting a patient."
            )

        try:
            ward_id = int(ward_id)
            bed_id = int(bed_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Invalid ward_id or bed_id."
            )

        ward = mongo_db.wards.find_one({
            "_id": ward_id,
            "is_active": {"$in": [True, 1]},
        })

        if ward is None:
            raise HTTPException(404, "Selected ward not found or inactive.")

        selected_bed = mongo_db.beds.find_one({
            "_id": bed_id
        })

        if selected_bed is None or not as_bool(
            selected_bed.get("is_active")
        ):
            raise HTTPException(
                status_code=404,
                detail="Selected bed not found or inactive."
            )

        if selected_bed.get("ward_id") != ward_id:
            raise HTTPException(
                status_code=400,
                detail="Selected bed does not belong to selected ward."
            )

        if as_bool(selected_bed.get("is_occupied")):
            raise HTTPException(
                status_code=409,
                detail="Selected bed is already occupied."
            )
    else:
        ward_id = None
        bed_id = None

    # Ensure unique patient identifiers and QR tokens.
    ensure_patient_indexes()

    patient_code = generate_patient_id()

    qr_token = generate_patient_qr_token()

    while mongo_db.patients.find_one(
        {"qr_token": qr_token},
        {"_id": 1}
    ):
        qr_token = generate_patient_qr_token()

    now = now_string()

    patient_number = next_numeric_id("patients")
    encounter_number = next_numeric_id("encounters")
    billing_number = next_numeric_id("patient_billing")

    patient_doc = {
        "_id": patient_number,
        "id": patient_number,
        "patient_id": patient_code,
        "first_name": first_name,
        "last_name": last_name,
        "date_of_birth": dob,
        "age": age_int if age_int is not None else (date.today().year - int(dob[:4]) if dob and len(str(dob)) >= 4 else None),
        "gender": gender,
        "weight_kg": weight,
        "mobile_number": mobile,
        "email": email,
        "address": address,
        "emergency_contact_name": emergency_name,
        "emergency_contact_number": emergency_number,
        "emergency_contact_relationship": emergency_relationship,
        "preferred_language": preferred_language,
        "ward_id": ward_id,
        "bed_id": bed_id,
        "is_active": True,
        "qr_token": qr_token,
        "qr_generated_at": now,
        "qr_is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    encounter_doc = {
        "_id": encounter_number,
        "id": encounter_number,
        "patient_id": patient_number,
        "doctor_id": doctor_id,
        "encounter_type": "INPATIENT" if is_admitted else "OPD",
        "status": "ACTIVE",
        "chief_complaint": chief_complaint,
        "symptom_duration": symptom_duration,
        "symptom_severity": symptom_severity,
        "visit_notes": visit_notes,
        "medical_history_notes": medical_history_notes,
        "current_medication_notes": current_medication_notes,
        "allergy_notes": allergy_notes,
        "clinical_observations": clinical_observations,
        "admitted_at": now if is_admitted else None,
        "discharged_at": None,
        "discharge_reason": None,
        "discharged_by": None,
        "created_at": now,
        "updated_at": now,
    }

    billing_doc = {
        "_id": billing_number,
        "id": billing_number,
        "patient_id": patient_number,
        "bill_status": "PENDING",
        "bill_amount": None,
        "paid_at": None,
        "paid_by": None,
        "created_at": now,
        "updated_at": now,
    }

    # Reserve the bed atomically to avoid double allocation.
    bed_reserved = False

    if selected_bed is not None:
        reservation = mongo_db.beds.update_one(
            {
                "_id": bed_id,
                "ward_id": ward_id,
                "is_active": {"$in": [True, 1]},
                "is_occupied": {"$in": [False, 0]},
            },
            {
                "$set": {
                    "is_occupied": True,
                    "updated_at": now,
                }
            }
        )

        if reservation.modified_count != 1:
            raise HTTPException(
                status_code=409,
                detail="Selected bed is no longer available."
            )

        bed_reserved = True

    inserted = []

    try:
        mongo_db.patients.insert_one(patient_doc)
        inserted.append(("patients", patient_number))

        mongo_db.encounters.insert_one(encounter_doc)
        inserted.append(("encounters", encounter_number))

        mongo_db.patient_billing.insert_one(billing_doc)
        inserted.append(("patient_billing", billing_number))

    except Exception as exc:
        # Compensating cleanup if a multi-document write fails.
        for collection_name, record_id in reversed(inserted):
            try:
                mongo_db[collection_name].delete_one({
                    "_id": record_id
                })
            except Exception:
                pass

        if bed_reserved:
            try:
                mongo_db.beds.update_one(
                    {"_id": bed_id},
                    {"$set": {
                        "is_occupied": False,
                        "updated_at": now,
                    }}
                )
            except Exception:
                pass

        if isinstance(exc, DuplicateKeyError):
            raise HTTPException(
                status_code=409,
                detail="A duplicate patient record was detected. Please retry."
            ) from exc

        raise HTTPException(
            status_code=500,
            detail="Patient registration failed. Check MongoDB and retry."
        ) from exc

    return {
        "message": "Patient registered successfully.",
        "patient": patient_to_dict(patient_doc),
        "encounter": {
            "id": encounter_number,
            "doctor_id": doctor_id,
            "doctor_name": doctor.get("full_name"),
            "encounter_type": encounter_doc["encounter_type"],
            "status": "ACTIVE",
            "chief_complaint": chief_complaint,
            "symptom_duration": symptom_duration,
            "symptom_severity": symptom_severity,
            "visit_notes": visit_notes,
            "medical_history_notes": medical_history_notes,
            "current_medication_notes": current_medication_notes,
            "allergy_notes": allergy_notes,
            "clinical_observations": clinical_observations,
            "admitted_at": encounter_doc["admitted_at"],
        },
        "billing": {
            "id": billing_number,
            "bill_status": "PENDING",
            "bill_amount": None,
        },
    }


# =====================================================
# REGENERATE PATIENT QR
# =====================================================

@router.post("/patients/{patient_id}/qr/regenerate")
def regenerate_patient_qr(
    patient_id: int,
    current_user=Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    ensure_patient_indexes()

    patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    if patient is None:
        raise HTTPException(404, "Patient not found.")

    if not as_bool(patient.get("is_active")):
        raise HTTPException(
            status_code=409,
            detail="Cannot regenerate QR for a discharged patient."
        )

    token = generate_patient_qr_token()

    while mongo_db.patients.find_one(
        {"qr_token": token},
        {"_id": 1}
    ):
        token = generate_patient_qr_token()

    now = now_string()

    mongo_db.patients.update_one(
        {"_id": patient_id},
        {
            "$set": {
                "qr_token": token,
                "qr_generated_at": now,
                "qr_is_active": True,
                "updated_at": now,
            }
        }
    )

    return {
        "message": "Patient QR token regenerated successfully.",
        "patient_id": patient_id,
        "qr_generated_at": now,
        "qr_is_active": True,
    }
