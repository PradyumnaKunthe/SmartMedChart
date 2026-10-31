
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.mongo_client import mongo_db
from app.schemas.admin import (
    AssignmentCreateRequest,
    StaffCreateRequest,
)
from app.security import (
    get_current_user,
    hash_password,
    require_permission,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


# =========================================================
# COMMON HELPERS
# =========================================================

def admin_mongo_now():
    return datetime.utcnow().isoformat(timespec="microseconds")


def mongo_bool(value):
    return value is True or value == 1 or str(value).lower() in (
        "true", "1", "yes"
    )


def active_filter():
    return {"$in": [True, 1]}


def next_admin_mongo_id(collection_name: str) -> int:
    """
    Generate sequential numeric IDs while preserving
    existing SQLite IDs already migrated to MongoDB.
    """
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
        return_document=ReturnDocument.AFTER,
    )

    return int(result["value"])


def require_admin_permission(current_user):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }

    if "MANAGE_USERS" not in permission_names:
        raise HTTPException(
            status_code=403,
            detail="Administrator permission required.",
        )


def require_ward_read_permission(
    current_user=Depends(get_current_user),
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
            detail=(
                "Permission required to view "
                "hospital wards and beds."
            ),
        )

    return current_user


def require_bed_assignment_permission(
    current_user=Depends(get_current_user),
):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }

    if not (
        {"MANAGE_SYSTEM", "REGISTER_PATIENT", "CREATE_PRESCRIPTION"}
        & permission_names
    ):
        raise HTTPException(
            status_code=403,
            detail="Permission required to assign or release hospital beds.",
        )

    return current_user


def get_role(role_name: str):
    role = mongo_db.roles.find_one({
        "name": role_name
    })

    if role is None:
        raise HTTPException(
            status_code=500,
            detail=f"Role '{role_name}' does not exist.",
        )

    return role


def serialize_staff(user):
    role = mongo_db.roles.find_one({
        "_id": user.get("role_id")
    })

    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": role.get("name") if role else None,
        "is_active": mongo_bool(user.get("is_active")),
        "created_at": user.get("created_at"),
    }


def serialize_patient(patient):
    return {
        "id": patient.get("id"),
        "patient_id": patient.get("patient_id"),
        "first_name": patient.get("first_name"),
        "last_name": patient.get("last_name"),
        "full_name": (
            f"{patient.get('first_name', '')} "
            f"{patient.get('last_name', '')}"
        ).strip(),
        "date_of_birth": patient.get("date_of_birth"),
        "gender": patient.get("gender"),
        "weight_kg": patient.get("weight_kg"),
        "ward_id": patient.get("ward_id"),
        "bed_id": patient.get("bed_id"),
        "is_active": mongo_bool(patient.get("is_active")),
        "qr_is_active": mongo_bool(patient.get("qr_is_active")),
    }


def serialize_workload_patient(patient):
    data = serialize_patient(patient)
    data["mobile_number"] = patient.get("mobile_number")
    return data


def serialize_billing(billing):
    if billing is None:
        return {
            "bill_status": "PENDING",
            "bill_amount": None,
            "paid_at": None,
            "paid_by": None,
        }

    amount = billing.get("bill_amount")

    return {
        "id": billing.get("id"),
        "bill_status": billing.get("bill_status"),
        "bill_amount": (
            float(amount) if amount is not None else None
        ),
        "paid_at": billing.get("paid_at"),
        "paid_by": billing.get("paid_by"),
        "created_at": billing.get("created_at"),
        "updated_at": billing.get("updated_at"),
    }


def serialize_encounter(encounter):
    if encounter is None:
        return None

    doctor = None

    if encounter.get("doctor_id") is not None:
        doctor = mongo_db.users.find_one({
            "_id": encounter["doctor_id"]
        })

    return {
        "id": encounter.get("id"),
        "patient_id": encounter.get("patient_id"),
        "doctor_id": encounter.get("doctor_id"),
        "doctor_name": (
            doctor.get("full_name") if doctor else None
        ),
        "encounter_type": encounter.get("encounter_type"),
        "status": encounter.get("status"),
        "admitted_at": encounter.get("admitted_at"),
        "discharged_at": encounter.get("discharged_at"),
        "discharge_reason": encounter.get("discharge_reason"),
        "discharged_by": encounter.get("discharged_by"),
        "created_at": encounter.get("created_at"),
        "updated_at": encounter.get("updated_at"),
    }


# =========================================================
# STAFF MANAGEMENT
# =========================================================

@router.get("/staff")
def get_staff(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    users = list(
        mongo_db.users.find({}).sort([
            ("full_name", 1),
            ("username", 1),
        ])
    )

    return {
        "staff": [
            serialize_staff(user)
            for user in users
        ]
    }


@router.get("/nurses")
def get_nurses(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    nurse_role = get_role("Nurse")

    nurses = list(
        mongo_db.users.find({
            "role_id": nurse_role["id"],
            "is_active": active_filter(),
        }).sort("full_name", 1)
    )

    return {
        "nurses": [
            serialize_staff(nurse)
            for nurse in nurses
        ]
    }


@router.get("/doctors")
def get_doctors(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    doctor_role = get_role("Doctor")

    doctors = list(
        mongo_db.users.find({
            "role_id": doctor_role["id"],
            "is_active": active_filter(),
        }).sort("full_name", 1)
    )

    return {
        "doctors": [
            serialize_staff(doctor)
            for doctor in doctors
        ]
    }


@router.post("/staff")
def create_staff(
    request: StaffCreateRequest,
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    role_name = request.role.strip().lower()

    allowed_roles = {
        "nurse": "Nurse",
        "doctor": "Doctor",
        "receptionist": "Receptionist",
    }

    actual_role_name = allowed_roles.get(role_name)

    if actual_role_name is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only Nurse, Doctor, and Receptionist "
                "accounts can be created here."
            ),
        )

    username = request.username.strip()
    email = request.email.strip()

    if mongo_db.users.find_one({"username": username}):
        raise HTTPException(
            status_code=409,
            detail="Username already exists.",
        )

    if mongo_db.users.find_one({"email": email}):
        raise HTTPException(
            status_code=409,
            detail="Email already exists.",
        )

    role = get_role(actual_role_name)
    now = admin_mongo_now()
    user_id = next_admin_mongo_id("users")

    user = {
        "_id": user_id,
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": hash_password(request.password),
        "full_name": request.full_name.strip(),
        "role_id": role["id"],
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        mongo_db.users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to create staff account because "
                "the username or email already exists."
            ),
        ) from exc

    return {
        "message": f"{actual_role_name} account created successfully.",
        "staff": serialize_staff(user),
    }


# =========================================================
# PATIENTS
# =========================================================

@router.get("/patients")
def get_patients(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    patients = list(
        mongo_db.patients.find({
            "is_active": active_filter(),
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )

    return {
        "patients": [
            {
                "id": patient["id"],
                "patient_id": patient.get("patient_id"),
                "first_name": patient.get("first_name"),
                "last_name": patient.get("last_name"),
                "full_name": (
                    f"{patient.get('first_name', '')} "
                    f"{patient.get('last_name', '')}"
                ).strip(),
                "is_active": mongo_bool(
                    patient.get("is_active")
                ),
            }
            for patient in patients
        ]
    }


# =========================================================
# NURSE-PATIENT ASSIGNMENTS
# =========================================================

@router.get("/assignments")
def get_assignments(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    rows = list(
        mongo_db.nurse_patient_assignments.find({
            "is_active": active_filter()
        }).sort("assigned_at", -1)
    )

    result = []

    for assignment in rows:
        nurse = mongo_db.users.find_one({
            "_id": assignment["nurse_id"]
        })

        patient = mongo_db.patients.find_one({
            "_id": assignment["patient_id"]
        })

        if (
            nurse is None
            or patient is None
            or not mongo_bool(patient.get("is_active"))
            or patient.get("lifecycle_status") == "DISCHARGED"
        ):
            continue

        result.append({
            "id": assignment["id"],
            "nurse_id": nurse["id"],
            "nurse_name": nurse.get("full_name"),
            "nurse_username": nurse.get("username"),
            "patient_id": patient["id"],
            "patient_code": patient.get("patient_id"),
            "patient_name": (
                f"{patient.get('first_name', '')} "
                f"{patient.get('last_name', '')}"
            ).strip(),
            "assigned_at": assignment.get("assigned_at"),
            "is_active": mongo_bool(
                assignment.get("is_active")
            ),
        })

    return {"assignments": result}


@router.post("/assignments")
def create_assignment(
    request: AssignmentCreateRequest,
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    nurse_role = get_role("Nurse")

    nurse = mongo_db.users.find_one({
        "_id": request.nurse_id,
        "role_id": nurse_role["id"],
        "is_active": active_filter(),
    })

    if nurse is None:
        raise HTTPException(
            status_code=404,
            detail="Active nurse not found.",
        )

    patient = mongo_db.patients.find_one({
        "_id": request.patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    existing = mongo_db.nurse_patient_assignments.find_one({
        "nurse_id": nurse["id"],
        "patient_id": patient["id"],
    })

    now = admin_mongo_now()

    if existing is not None:
        if mongo_bool(existing.get("is_active")):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This patient is already assigned "
                    "to this nurse."
                ),
            )

        mongo_db.nurse_patient_assignments.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "is_active": True,
                "assigned_at": now,
            }},
        )

        return {
            "message": "Patient assignment reactivated successfully.",
            "assignment": {
                "id": existing["id"],
                "nurse_id": nurse["id"],
                "nurse_name": nurse.get("full_name"),
                "patient_id": patient["id"],
                "patient_name": (
                    f"{patient.get('first_name', '')} "
                    f"{patient.get('last_name', '')}"
                ).strip(),
                "patient_code": patient.get("patient_id"),
                "is_active": True,
            },
        }

    assignment_id = next_admin_mongo_id(
        "nurse_patient_assignments"
    )

    assignment = {
        "_id": assignment_id,
        "id": assignment_id,
        "nurse_id": nurse["id"],
        "patient_id": patient["id"],
        "assigned_at": now,
        "is_active": True,
    }

    mongo_db.nurse_patient_assignments.insert_one(assignment)

    return {
        "message": "Patient assigned to nurse successfully.",
        "assignment": {
            "id": assignment_id,
            "nurse_id": nurse["id"],
            "nurse_name": nurse.get("full_name"),
            "patient_id": patient["id"],
            "patient_name": (
                f"{patient.get('first_name', '')} "
                f"{patient.get('last_name', '')}"
            ).strip(),
            "patient_code": patient.get("patient_id"),
            "is_active": True,
        },
    }


@router.delete("/assignments/{assignment_id}")
def deactivate_assignment(
    assignment_id: int,
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    assignment = mongo_db.nurse_patient_assignments.find_one({
        "_id": assignment_id
    })

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found.",
        )

    mongo_db.nurse_patient_assignments.update_one(
        {"_id": assignment_id},
        {"$set": {"is_active": False}},
    )

    return {
        "message": "Patient assignment removed successfully.",
        "assignment_id": assignment_id,
    }


# =========================================================
# DOCTOR-PATIENT ASSIGNMENTS
# =========================================================

@router.get("/doctor-assignments")
def get_doctor_assignments(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    encounters = list(
        mongo_db.encounters.find({
            "doctor_id": {"$ne": None},
            "status": "ACTIVE",
        }).sort("created_at", -1)
    )

    result = []

    for encounter in encounters:
        doctor = mongo_db.users.find_one({
            "_id": encounter.get("doctor_id"),
            "is_active": active_filter(),
        })

        patient = mongo_db.patients.find_one({
            "_id": encounter["patient_id"],
            "is_active": active_filter(),
        })

        if doctor is None or patient is None:
            continue

        result.append({
            "id": encounter["id"],
            "doctor_id": doctor["id"],
            "doctor_name": doctor.get("full_name"),
            "doctor_username": doctor.get("username"),
            "patient_id": patient["id"],
            "patient_code": patient.get("patient_id"),
            "patient_name": (
                f"{patient.get('first_name', '')} "
                f"{patient.get('last_name', '')}"
            ).strip(),
            "encounter_type": encounter.get("encounter_type"),
            "encounter_status": encounter.get("status"),
            "assigned_at": encounter.get("created_at"),
        })

    return {"assignments": result}


@router.post("/doctor-assignments")
def assign_patient_to_doctor(
    request: dict,
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    try:
        doctor_id = int(request.get("doctor_id"))
        patient_id = int(request.get("patient_id"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="doctor_id and patient_id are required integers.",
        ) from exc

    doctor_role = get_role("Doctor")

    doctor = mongo_db.users.find_one({
        "_id": doctor_id,
        "role_id": doctor_role["id"],
        "is_active": active_filter(),
    })

    if doctor is None:
        raise HTTPException(
            status_code=404,
            detail="Active doctor not found.",
        )

    patient = mongo_db.patients.find_one({
        "_id": patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    now = admin_mongo_now()

    encounter = mongo_db.encounters.find_one(
        {
            "patient_id": patient_id,
            "status": "ACTIVE",
        },
        sort=[("created_at", -1)],
    )

    if encounter is None:
        encounter_id = next_admin_mongo_id("encounters")

        encounter_type = (
            "INPATIENT"
            if patient.get("bed_id") is not None
            else "OPD"
        )

        encounter = {
            "_id": encounter_id,
            "id": encounter_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "encounter_type": encounter_type,
            "status": "ACTIVE",
            "admitted_at": (
                now if encounter_type == "INPATIENT" else None
            ),
            "discharged_at": None,
            "discharge_reason": None,
            "discharged_by": None,
            "created_at": now,
            "updated_at": now,
        }

        mongo_db.encounters.insert_one(encounter)

    else:
        mongo_db.encounters.update_one(
            {"_id": encounter["_id"]},
            {"$set": {
                "doctor_id": doctor_id,
                "updated_at": now,
            }},
        )

        encounter["doctor_id"] = doctor_id
        encounter["updated_at"] = now

    return {
        "message": "Patient assigned to doctor successfully.",
        "assignment": {
            "id": encounter["id"],
            "doctor_id": doctor["id"],
            "doctor_name": doctor.get("full_name"),
            "doctor_username": doctor.get("username"),
            "patient_id": patient["id"],
            "patient_code": patient.get("patient_id"),
            "patient_name": (
                f"{patient.get('first_name', '')} "
                f"{patient.get('last_name', '')}"
            ).strip(),
            "encounter_type": encounter.get("encounter_type"),
            "encounter_status": encounter.get("status"),
            "assigned_at": encounter.get("created_at"),
        },
    }


@router.delete("/doctor-assignments/{encounter_id}")
def remove_patient_from_doctor(
    encounter_id: int,
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    encounter = mongo_db.encounters.find_one({
        "_id": encounter_id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Active doctor assignment not found.",
        )

    mongo_db.encounters.update_one(
        {"_id": encounter_id},
        {"$set": {
            "doctor_id": None,
            "updated_at": admin_mongo_now(),
        }},
    )

    return {
        "message": "Patient removed from doctor assignment.",
        "encounter_id": encounter_id,
    }


# =========================================================
# STAFF WORKLOAD
# =========================================================

@router.get("/workload/nurses")
def get_nurse_workload(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    nurse_role = get_role("Nurse")

    nurses = list(
        mongo_db.users.find({
            "role_id": nurse_role["id"],
            "is_active": active_filter(),
        }).sort([
            ("full_name", 1),
            ("username", 1),
        ])
    )

    result = []

    for nurse in nurses:
        assignments = list(
            mongo_db.nurse_patient_assignments.find({
                "nurse_id": nurse["id"],
                "is_active": active_filter(),
            }).sort("assigned_at", -1)
        )

        patients = []

        for assignment in assignments:
            patient = mongo_db.patients.find_one({
                "_id": assignment["patient_id"],
                "is_active": active_filter(),
            })

            if patient is None:
                continue

            patient_data = serialize_workload_patient(patient)
            patient_data["assignment_id"] = assignment["id"]
            patient_data["assigned_at"] = assignment.get("assigned_at")
            patients.append(patient_data)

        result.append({
            "id": nurse["id"],
            "full_name": nurse.get("full_name"),
            "username": nurse.get("username"),
            "email": nurse.get("email"),
            "role": "Nurse",
            "is_active": mongo_bool(nurse.get("is_active")),
            "patient_count": len(patients),
            "patients": patients,
        })

    return {
        "count": len(result),
        "nurses": result,
    }


@router.get("/workload/doctors")
def get_doctor_workload(
    current_user=Depends(require_permission("MANAGE_USERS")),
):
    require_admin_permission(current_user)

    doctor_role = get_role("Doctor")

    doctors = list(
        mongo_db.users.find({
            "role_id": doctor_role["id"],
            "is_active": active_filter(),
        }).sort([
            ("full_name", 1),
            ("username", 1),
        ])
    )

    result = []

    for doctor in doctors:
        encounters = list(
            mongo_db.encounters.find({
                "doctor_id": doctor["id"],
                "status": "ACTIVE",
            }).sort("created_at", -1)
        )

        patients = []
        seen_patient_ids = set()

        for encounter in encounters:
            patient_id = encounter["patient_id"]

            if patient_id in seen_patient_ids:
                continue

            patient = mongo_db.patients.find_one({
                "_id": patient_id,
                "is_active": active_filter(),
            })

            if patient is None:
                continue

            seen_patient_ids.add(patient_id)

            patient_data = serialize_workload_patient(patient)
            patient_data["encounter_id"] = encounter["id"]
            patient_data["encounter_type"] = encounter.get("encounter_type")
            patient_data["encounter_status"] = encounter.get("status")
            patient_data["admitted_at"] = encounter.get("admitted_at")
            patient_data["encounter_created_at"] = encounter.get(
                "created_at"
            )

            patients.append(patient_data)

        result.append({
            "id": doctor["id"],
            "full_name": doctor.get("full_name"),
            "username": doctor.get("username"),
            "email": doctor.get("email"),
            "role": "Doctor",
            "is_active": mongo_bool(doctor.get("is_active")),
            "patient_count": len(patients),
            "patients": patients,
        })

    return {
        "count": len(result),
        "doctors": result,
    }


# =========================================================
# PATIENT LIFECYCLE MANAGEMENT
# =========================================================

@router.get("/patients/lifecycle")
def get_patient_lifecycle(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    active_patients = list(
        mongo_db.patients.find({
            "is_active": active_filter(),
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )

    discharged_patients = list(
        mongo_db.patients.find({
            "$or": [
                {"is_active": {"$in": [False, 0]}},
                {"lifecycle_status": "DISCHARGED"},
            ]
        }).sort("updated_at", -1)
    )

    def patient_summary(patient):
        billing = mongo_db.patient_billing.find_one({
            "patient_id": patient["id"]
        })

        active_encounter = mongo_db.encounters.find_one(
            {
                "patient_id": patient["id"],
                "status": "ACTIVE",
            },
            sort=[("created_at", -1)],
        )

        data = serialize_patient(patient)

        data.update({
            "billing": serialize_billing(billing),
            "active_encounter": serialize_encounter(
                active_encounter
            ),
        })

        return data

    return {
        "active": [
            patient_summary(patient)
            for patient in active_patients
        ],
        "discharged": [
            patient_summary(patient)
            for patient in discharged_patients
        ],
        "counts": {
            "active": len(active_patients),
            "discharged": len(discharged_patients),
        },
    }


@router.get("/patients/discharged")
def get_discharged_patients(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    require_admin_permission(current_user)

    discharged_patients = list(
        mongo_db.patients.find({
            "$or": [
                {"is_active": {"$in": [False, 0]}},
                {"lifecycle_status": "DISCHARGED"},
            ]
        }).sort("discharged_at", -1)
    )

    def patient_summary(patient):
        billing = mongo_db.patient_billing.find_one({
            "patient_id": patient["id"]
        })

        latest_encounter = mongo_db.encounters.find_one(
            {"patient_id": patient["id"]},
            sort=[("discharged_at", -1), ("created_at", -1)],
        )

        data = serialize_patient(patient)
        data.update({
            "billing": serialize_billing(billing),
            "encounter": serialize_encounter(latest_encounter),
            "discharged_at": patient.get("discharged_at"),
            "discharge_reason": patient.get("discharge_reason"),
        })
        return data

    return {
        "count": len(discharged_patients),
        "discharged": [
            patient_summary(patient)
            for patient in discharged_patients
        ],
    }


@router.post("/patients/{patient_id}/billing")
@router.put("/patients/{patient_id}/billing")
def create_or_update_patient_bill(
    patient_id: int,
    request: dict,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    amount = request.get("bill_amount")

    if amount in (None, ""):
        bill_amount = None
    else:
        try:
            bill_amount = float(amount)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail="bill_amount must be a valid number.",
            ) from exc

        if bill_amount < 0:
            raise HTTPException(
                status_code=400,
                detail="bill_amount cannot be negative.",
            )

    billing = mongo_db.patient_billing.find_one({
        "patient_id": patient_id
    })

    now = admin_mongo_now()

    if billing is None:
        billing_id = next_admin_mongo_id("patient_billing")

        billing = {
            "_id": billing_id,
            "id": billing_id,
            "patient_id": patient_id,
            "bill_status": "PENDING",
            "bill_amount": bill_amount,
            "paid_at": None,
            "paid_by": None,
            "created_at": now,
            "updated_at": now,
        }

        mongo_db.patient_billing.insert_one(billing)

    else:
        if billing.get("bill_status") == "PAID":
            raise HTTPException(
                status_code=409,
                detail=(
                    "The patient's bill is already "
                    "marked as paid."
                ),
            )

        mongo_db.patient_billing.update_one(
            {"_id": billing["_id"]},
            {"$set": {
                "bill_amount": bill_amount,
                "bill_status": "PENDING",
                "updated_at": now,
            }},
        )

        billing["bill_amount"] = bill_amount
        billing["bill_status"] = "PENDING"
        billing["updated_at"] = now

    return {
        "message": "Patient bill updated successfully.",
        "billing": serialize_billing(billing),
    }


@router.post("/patients/{patient_id}/billing/paid")
def mark_patient_bill_paid(
    patient_id: int,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not mongo_bool(patient.get("is_active")):
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot update billing for a discharged patient."
            ),
        )

    billing = mongo_db.patient_billing.find_one({
        "patient_id": patient_id
    })

    now = admin_mongo_now()

    if billing is None:
        billing_id = next_admin_mongo_id("patient_billing")

        billing = {
            "_id": billing_id,
            "id": billing_id,
            "patient_id": patient_id,
            "bill_status": "PAID",
            "bill_amount": None,
            "paid_at": now,
            "paid_by": current_user.id,
            "created_at": now,
            "updated_at": now,
        }

        mongo_db.patient_billing.insert_one(billing)

    else:
        if billing.get("bill_status") == "PAID":
            return {
                "message": "Patient bill is already marked as paid.",
                "billing": serialize_billing(billing),
            }

        mongo_db.patient_billing.update_one(
            {"_id": billing["_id"]},
            {"$set": {
                "bill_status": "PAID",
                "paid_at": now,
                "paid_by": current_user.id,
                "updated_at": now,
            }},
        )

        billing.update({
            "bill_status": "PAID",
            "paid_at": now,
            "paid_by": current_user.id,
            "updated_at": now,
        })

    return {
        "message": "Patient bill marked as paid.",
        "billing": serialize_billing(billing),
    }


@router.post("/patients/{patient_id}/discharge")
def discharge_patient(
    patient_id: int,
    request: Any = Body(default={}),
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not mongo_bool(patient.get("is_active")):
        raise HTTPException(
            status_code=409,
            detail="Patient is already discharged.",
        )

    billing = mongo_db.patient_billing.find_one({
        "patient_id": patient_id
    })

    if billing is None or billing.get("bill_status") != "PAID":
        raise HTTPException(
            status_code=409,
            detail=(
                "Patient cannot be discharged until "
                "the bill is marked as paid."
            ),
        )

    discharge_reason = None
    if isinstance(request, dict):
        discharge_reason = request.get("discharge_reason")
    elif isinstance(request, str):
        discharge_reason = request
    if discharge_reason is not None:
        discharge_reason = str(discharge_reason).strip() or None

    now = admin_mongo_now()

    encounter_result = mongo_db.encounters.update_many(
        {
            "patient_id": patient_id,
            "status": "ACTIVE",
        },
        {"$set": {
            "status": "DISCHARGED",
            "discharged_at": now,
            "discharge_reason": discharge_reason,
            "discharged_by": current_user.id,
            "updated_at": now,
        }},
    )

    assignment_result = mongo_db.nurse_patient_assignments.update_many(
        {
            "patient_id": patient_id,
            "is_active": active_filter(),
        },
        {"$set": {"is_active": False, "status": "COMPLETED", "updated_at": now}},
    )

    released_bed_id = patient.get("bed_id")

    if released_bed_id is not None:
        mongo_db.beds.update_one(
            {"_id": released_bed_id},
            {"$set": {
                "is_occupied": 0,
                "occupied_by_patient_id": None,
                "updated_at": now,
            }},
        )

    # Release any bed occupied by this patient
    mongo_db.beds.update_many(
        {"occupied_by_patient_id": patient_id},
        {"$set": {
            "is_occupied": 0,
            "occupied_by_patient_id": None,
            "updated_at": now,
        }},
    )

    # Close active prescriptions for discharged patient
    mongo_db.prescriptions.update_many(
        {
            "patient_id": patient_id,
            "status": "ACTIVE",
        },
        {"$set": {
            "status": "DISCHARGED",
            "updated_at": now,
        }},
    )

    # Close applicable active medication schedules
    patient_prescriptions = list(
        mongo_db.prescriptions.find({"patient_id": patient_id})
    )
    prescription_ids = [p["_id"] for p in patient_prescriptions]
    prescription_item_ids = [
        it["_id"]
        for it in mongo_db.prescription_items.find(
            {"prescription_id": {"$in": prescription_ids}}
        )
    ]
    schedule_close_result = mongo_db.medication_schedules.update_many(
        {
            "prescription_item_id": {"$in": prescription_item_ids},
            "status": {"$in": ["UPCOMING", "SCHEDULED", "DUE", "PENDING", "DELAYED", "HELD"]},
        },
        {"$set": {
            "status": "CANCELLED",
            "notes": "Cancelled due to inpatient discharge",
            "updated_at": now,
        }},
    )

    mongo_db.patients.update_one(
        {"_id": patient_id},
        {"$set": {
            "is_active": False,
            "lifecycle_status": "DISCHARGED",
            "qr_is_active": False,
            "ward_id": None,
            "bed_id": None,
            "discharged_at": now,
            "discharge_reason": discharge_reason,
            "updated_at": now,
        }},
    )

    return {
        "message": "Patient discharged successfully.",
        "patient": {
            "id": patient["id"],
            "patient_id": patient.get("patient_id"),
            "full_name": (
                f"{patient.get('first_name', '')} "
                f"{patient.get('last_name', '')}"
            ).strip(),
            "is_active": False,
            "qr_is_active": False,
        },
        "discharge": {
            "discharged_at": now,
            "discharged_by": current_user.id,
            "discharge_reason": discharge_reason,
        },
        "released_bed_id": released_bed_id,
        "closed_assignments": assignment_result.modified_count,
        "closed_encounters": encounter_result.modified_count,
        "closed_schedules": schedule_close_result.modified_count,
    }


@router.get("/patients/{patient_id}/history")
def get_patient_history(
    patient_id: int,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    billing = mongo_db.patient_billing.find_one({
        "patient_id": patient_id
    })

    encounters = list(
        mongo_db.encounters.find({
            "patient_id": patient_id
        }).sort("created_at", -1)
    )

    assignments = list(
        mongo_db.nurse_patient_assignments.find({
            "patient_id": patient_id
        }).sort("assigned_at", -1)
    )

    assignment_history = []

    for assignment in assignments:
        nurse = mongo_db.users.find_one({
            "_id": assignment["nurse_id"]
        })

        assignment_history.append({
            "id": assignment["id"],
            "nurse_id": assignment["nurse_id"],
            "nurse_name": (
                nurse.get("full_name") if nurse else None
            ),
            "assigned_at": assignment.get("assigned_at"),
            "is_active": mongo_bool(
                assignment.get("is_active")
            ),
        })

    return {
        "patient": serialize_patient(patient),
        "billing": serialize_billing(billing),
        "encounters": [
            serialize_encounter(encounter)
            for encounter in encounters
        ],
        "nurse_assignments": assignment_history,
    }


# =========================================================
# WARD MANAGEMENT
# =========================================================

@router.get("/wards")
def get_wards(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    wards = list(
        mongo_db.wards.find({
            "is_active": active_filter()
        }).sort("id", 1)
    )

    result = []

    for ward in wards:
        bed_filter = {
            "ward_id": ward["id"],
            "is_active": active_filter(),
        }

        total_beds = mongo_db.beds.count_documents(bed_filter)

        occupied_beds = mongo_db.beds.count_documents({
            **bed_filter,
            "is_occupied": active_filter(),
        })

        result.append({
            "id": ward["id"],
            "name": ward.get("name"),
            "code": ward.get("code"),
            "description": ward.get("description"),
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "available_beds": total_beds - occupied_beds,
        })

    return {
        "count": len(result),
        "wards": result,
    }


@router.post("/wards")
def create_ward(
    request: dict,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    name = str(request.get("name", "")).strip()
    code = str(request.get("code", "")).strip()
    description = request.get("description")

    if description is not None:
        description = str(description).strip() or None

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Ward name is required.",
        )

    if not code:
        raise HTTPException(
            status_code=400,
            detail="Ward code is required.",
        )

    if mongo_db.wards.find_one({"name": name}):
        raise HTTPException(
            status_code=409,
            detail="A ward with this name already exists.",
        )

    if mongo_db.wards.find_one({"code": code}):
        raise HTTPException(
            status_code=409,
            detail="A ward with this code already exists.",
        )

    now = admin_mongo_now()
    ward_id = next_admin_mongo_id("wards")

    ward = {
        "_id": ward_id,
        "id": ward_id,
        "name": name,
        "code": code,
        "description": description,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        mongo_db.wards.insert_one(ward)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="Ward name or code already exists.",
        ) from exc

    return {
        "message": "Ward created successfully.",
        "ward": {
            "id": ward_id,
            "name": name,
            "code": code,
            "description": description,
            "is_active": True,
            "total_beds": 0,
            "occupied_beds": 0,
            "available_beds": 0,
        },
    }


# =========================================================
# BED MANAGEMENT
# =========================================================

@router.get("/wards/{ward_id}/beds")
def get_ward_beds(
    ward_id: int,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    ward = mongo_db.wards.find_one({
        "_id": ward_id,
        "is_active": active_filter(),
    })

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found.",
        )

    beds = list(
        mongo_db.beds.find({
            "ward_id": ward_id,
            "is_active": active_filter(),
        }).sort("bed_number", 1)
    )

    result = []

    for bed in beds:
        patient = mongo_db.patients.find_one({
            "bed_id": bed["id"],
            "is_active": active_filter(),
        })

        occupied = mongo_bool(bed.get("is_occupied"))

        result.append({
            "id": bed["id"],
            "bed_number": bed.get("bed_number"),
            "ward_id": bed.get("ward_id"),
            "is_active": mongo_bool(bed.get("is_active")),
            "is_occupied": occupied,
            "status": "OCCUPIED" if occupied else "AVAILABLE",
            "patient": (
                {
                    "id": patient["id"],
                    "patient_id": patient.get("patient_id"),
                    "full_name": (
                        f"{patient.get('first_name', '')} "
                        f"{patient.get('last_name', '')}"
                    ).strip(),
                }
                if patient else None
            ),
        })

    occupied_count = sum(
        1 for bed in result if bed["is_occupied"]
    )

    return {
        "ward": {
            "id": ward["id"],
            "name": ward.get("name"),
            "code": ward.get("code"),
            "description": ward.get("description"),
        },
        "counts": {
            "total": len(result),
            "occupied": occupied_count,
            "available": len(result) - occupied_count,
        },
        "beds": result,
    }


@router.post("/wards/{ward_id}/beds")
def create_bed(
    ward_id: int,
    request: dict,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    ward = mongo_db.wards.find_one({
        "_id": ward_id,
        "is_active": active_filter(),
    })

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found.",
        )

    bed_number = str(request.get("bed_number", "")).strip()

    if not bed_number:
        raise HTTPException(
            status_code=400,
            detail="Bed number is required.",
        )

    existing_bed = mongo_db.beds.find_one({
        "ward_id": ward_id,
        "bed_number": bed_number,
    })

    now = admin_mongo_now()

    if existing_bed is not None:
        if mongo_bool(existing_bed.get("is_active")):
            raise HTTPException(
                status_code=409,
                detail=(
                    "A bed with this number already exists "
                    "in this ward."
                ),
            )

        assigned_patient = mongo_db.patients.find_one({
            "bed_id": existing_bed["id"],
            "is_active": active_filter(),
        })

        if assigned_patient:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This bed is still assigned to an active patient."
                ),
            )

        mongo_db.beds.update_one(
            {"_id": existing_bed["_id"]},
            {"$set": {
                "is_active": True,
                "is_occupied": False,
                "updated_at": now,
            }},
        )

        return {
            "message": "Bed reactivated successfully.",
            "bed": {
                "id": existing_bed["id"],
                "ward_id": ward_id,
                "bed_number": bed_number,
                "is_active": True,
                "is_occupied": False,
                "status": "AVAILABLE",
            },
        }

    bed_id = next_admin_mongo_id("beds")

    bed = {
        "_id": bed_id,
        "id": bed_id,
        "ward_id": ward_id,
        "bed_number": bed_number,
        "is_active": True,
        "is_occupied": False,
        "created_at": now,
        "updated_at": now,
    }

    try:
        mongo_db.beds.insert_one(bed)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="Unable to create bed.",
        ) from exc

    return {
        "message": "Bed created successfully.",
        "bed": {
            "id": bed_id,
            "ward_id": ward_id,
            "bed_number": bed_number,
            "is_active": True,
            "is_occupied": False,
            "status": "AVAILABLE",
        },
    }


@router.delete("/wards/{ward_id}/beds/{bed_id}")
def deactivate_bed(
    ward_id: int,
    bed_id: int,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    bed = mongo_db.beds.find_one({
        "_id": bed_id,
        "ward_id": ward_id,
    })

    if bed is None:
        raise HTTPException(
            status_code=404,
            detail="Bed not found.",
        )

    assigned_patient = mongo_db.patients.find_one({
        "bed_id": bed_id,
        "is_active": active_filter(),
    })

    if (
        mongo_bool(bed.get("is_occupied"))
        or assigned_patient is not None
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Occupied beds cannot be deactivated. "
                "Discharge or move the patient first."
            ),
        )

    mongo_db.beds.update_one(
        {"_id": bed_id},
        {"$set": {
            "is_active": False,
            "updated_at": admin_mongo_now(),
        }},
    )

    return {
        "message": "Bed deactivated successfully.",
        "bed_id": bed_id,
    }


# =========================================================
# PATIENT BED ASSIGNMENT
# =========================================================

@router.post("/patients/{patient_id}/assign-bed")
def assign_patient_bed(
    patient_id: int,
    request: dict,
    current_user=Depends(require_bed_assignment_permission),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    try:
        ward_id = int(request.get("ward_id"))
        bed_id = int(request.get("bed_id"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="ward_id and bed_id are required integers.",
        ) from exc

    ward = mongo_db.wards.find_one({
        "_id": ward_id,
        "is_active": active_filter(),
    })

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found or inactive.",
        )

    bed = mongo_db.beds.find_one({
        "_id": bed_id,
        "ward_id": ward_id,
        "is_active": active_filter(),
    })

    if bed is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Bed not found, inactive, or not part "
                "of the selected ward."
            ),
        )

    previous_bed_id = patient.get("bed_id")

    other_patient = mongo_db.patients.find_one({
        "bed_id": bed_id,
        "_id": {"$ne": patient_id},
        "is_active": active_filter(),
    })

    if other_patient:
        raise HTTPException(
            status_code=409,
            detail="This bed is already assigned to another active patient.",
        )

    now = admin_mongo_now()
    same_bed = previous_bed_id == bed_id

    if same_bed:
        mongo_db.beds.update_one(
            {"_id": bed_id},
            {"$set": {
                "is_occupied": True,
                "updated_at": now,
            }},
        )
    else:
        reservation = mongo_db.beds.update_one(
            {
                "_id": bed_id,
                "ward_id": ward_id,
                "is_active": active_filter(),
                "is_occupied": {"$in": [False, 0]},
            },
            {"$set": {
                "is_occupied": True,
                "updated_at": now,
            }},
        )

        if reservation.modified_count != 1:
            raise HTTPException(
                status_code=409,
                detail="This bed is already occupied or unavailable.",
            )

    try:
        patient_update = mongo_db.patients.update_one(
            {
                "_id": patient_id,
                "is_active": active_filter(),
            },
            {"$set": {
                "ward_id": ward_id,
                "bed_id": bed_id,
                "updated_at": now,
            }},
        )

        if patient_update.matched_count != 1:
            raise RuntimeError("Patient bed update failed.")

        encounter = mongo_db.encounters.find_one(
            {
                "patient_id": patient_id,
                "status": "ACTIVE",
            },
            sort=[("created_at", -1)],
        )

        if encounter is None:
            encounter_id = next_admin_mongo_id("encounters")

            encounter = {
                "_id": encounter_id,
                "id": encounter_id,
                "patient_id": patient_id,
                "doctor_id": None,
                "encounter_type": "INPATIENT",
                "status": "ACTIVE",
                "admitted_at": now,
                "discharged_at": None,
                "discharge_reason": None,
                "discharged_by": None,
                "created_at": now,
                "updated_at": now,
            }

            mongo_db.encounters.insert_one(encounter)

        else:
            encounter_updates = {
                "encounter_type": "INPATIENT",
                "updated_at": now,
            }

            if not encounter.get("admitted_at"):
                encounter_updates["admitted_at"] = now

            mongo_db.encounters.update_one(
                {"_id": encounter["_id"]},
                {"$set": encounter_updates},
            )

            encounter.update(encounter_updates)

    except Exception as exc:
        if not same_bed:
            mongo_db.beds.update_one(
                {"_id": bed_id},
                {"$set": {
                    "is_occupied": False,
                    "updated_at": now,
                }},
            )

        raise HTTPException(
            status_code=500,
            detail="Bed assignment could not be completed.",
        ) from exc

    if previous_bed_id is not None and not same_bed:
        mongo_db.beds.update_one(
            {"_id": previous_bed_id},
            {"$set": {
                "is_occupied": False,
                "updated_at": now,
            }},
        )

    updated_patient = mongo_db.patients.find_one({
        "_id": patient_id
    })

    return {
        "message": "Patient assigned to bed successfully.",
        "patient": {
            "id": updated_patient["id"],
            "patient_id": updated_patient.get("patient_id"),
            "full_name": (
                f"{updated_patient.get('first_name', '')} "
                f"{updated_patient.get('last_name', '')}"
            ).strip(),
            "ward_id": updated_patient.get("ward_id"),
            "bed_id": updated_patient.get("bed_id"),
            "is_active": mongo_bool(
                updated_patient.get("is_active")
            ),
        },
        "ward": {
            "id": ward["id"],
            "name": ward.get("name"),
            "code": ward.get("code"),
        },
        "bed": {
            "id": bed["id"],
            "bed_number": bed.get("bed_number"),
            "is_occupied": True,
        },
        "encounter": {
            "id": encounter["id"],
            "encounter_type": encounter.get("encounter_type"),
            "status": encounter.get("status"),
            "admitted_at": encounter.get("admitted_at"),
        },
        "previous_bed_id": previous_bed_id,
    }


@router.post("/patients/{patient_id}/release-bed")
def release_patient_bed(
    patient_id: int,
    current_user=Depends(require_bed_assignment_permission),
):
    patient = mongo_db.patients.find_one({
        "_id": patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    previous_bed_id = patient.get("bed_id")

    if previous_bed_id is None:
        return {
            "message": "Patient has no assigned bed.",
            "patient_id": patient["id"],
            "bed_id": None,
        }

    now = admin_mongo_now()

    result = mongo_db.patients.update_one(
        {
            "_id": patient_id,
            "bed_id": previous_bed_id,
        },
        {"$set": {
            "bed_id": None,
            "ward_id": None,
            "updated_at": now,
        }},
    )

    if result.matched_count != 1:
        raise HTTPException(
            status_code=409,
            detail="Patient bed assignment changed. Please retry.",
        )

    mongo_db.beds.update_one(
        {"_id": previous_bed_id},
        {"$set": {
            "is_occupied": False,
            "updated_at": now,
        }},
    )

    return {
        "message": "Patient bed released successfully.",
        "patient_id": patient["id"],
        "released_bed_id": previous_bed_id,
    }


# =========================================================
# PATIENT READMISSION ENDPOINT
# =========================================================

class ReadmitPatientRequest(BaseModel):
    ward_id: int | None = None
    bed_id: int | None = None
    doctor_id: int | None = None
    chief_complaint: str | None = None
    admission_notes: str | None = None


@router.post("/patients/{patient_id}/readmit")
def readmit_patient(
    patient_id: int,
    request: ReadmitPatientRequest,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    """
    Readmit a discharged patient with a new active encounter and bed assignment,
    while fully preserving past encounters and historical clinical records.
    """
    patient = mongo_db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    if mongo_bool(patient.get("is_active")):
        raise HTTPException(status_code=400, detail="Patient is already active in hospital.")

    now = admin_mongo_now()
    ward_id = request.ward_id
    bed_id = request.bed_id

    # If bed is requested, verify availability
    if bed_id:
        bed = mongo_db.beds.find_one({"_id": bed_id, "is_active": active_filter()})
        if not bed:
            raise HTTPException(status_code=404, detail="Requested bed not found or inactive.")
        if mongo_bool(bed.get("is_occupied")) and bed.get("occupied_by_patient_id") not in (None, patient_id):
            raise HTTPException(status_code=409, detail="Selected bed is already occupied by another patient.")
        mongo_db.beds.update_one(
            {"_id": bed_id},
            {"$set": {"is_occupied": 1, "occupied_by_patient_id": patient_id, "updated_at": now}}
        )

    # Generate new QR token
    token = f"QR-PAT-{patient_id}-{int(datetime.utcnow().timestamp())}"

    # Create new active encounter
    encounter_id = next_admin_mongo_id("encounters")
    encounter = {
        "_id": encounter_id,
        "id": encounter_id,
        "patient_id": patient_id,
        "doctor_id": request.doctor_id,
        "encounter_type": "INPATIENT" if bed_id else "OPD",
        "status": "ACTIVE",
        "chief_complaint": request.chief_complaint or "Readmitted patient",
        "visit_notes": request.admission_notes,
        "admitted_at": now,
        "discharged_at": None,
        "discharge_reason": None,
        "discharged_by": None,
        "ward_id": ward_id,
        "bed_id": bed_id,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.encounters.insert_one(encounter)

    # Update patient to ACTIVE
    mongo_db.patients.update_one(
        {"_id": patient_id},
        {"$set": {
            "is_active": True,
            "lifecycle_status": "ACTIVE",
            "qr_token": token,
            "qr_is_active": True,
            "qr_generated_at": now,
            "ward_id": ward_id,
            "bed_id": bed_id,
            "admission_date": now,
            "discharged_at": None,
            "discharge_reason": None,
            "updated_at": now,
        }}
    )

    # Reset or initialize active billing
    mongo_db.patient_billing.update_one(
        {"patient_id": patient_id},
        {"$set": {
            "bill_status": "PENDING",
            "bill_amount": 0.0,
            "paid_at": None,
            "updated_at": now,
        }},
        upsert=True,
    )

    return {
        "message": "Patient readmitted successfully.",
        "patient_id": patient_id,
        "encounter_id": encounter_id,
        "ward_id": ward_id,
        "bed_id": bed_id,
        "is_active": True,
    }
