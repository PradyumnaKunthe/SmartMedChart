from datetime import date, datetime
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.mongo_client import mongo_db
from app.security import require_permission


router = APIRouter(
    prefix="/api/carematch",
    tags=["CareMatch"],
)


# ---------------------------------------------------------
# REQUEST MODEL
# ---------------------------------------------------------

class DoctorProfileRequest(BaseModel):
    qualifications: str = Field(default="", max_length=300)

    specializations: list[str] = Field(default_factory=list)

    experience_years: int = Field(default=0, ge=0, le=80)

    expertise_keywords: list[str] = Field(default_factory=list)

    languages: list[str] = Field(default_factory=list)

    consultation_fee: float | None = Field(default=None, ge=0)

    available_days: list[str] = Field(default_factory=list)

    is_available: bool = True


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

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


def clean_list(values: list[str], limit: int = 30) -> list[str]:
    """Trim entries and remove duplicates."""
    cleaned = []
    seen = set()

    for value in values:
        item = value.strip()

        if not item:
            continue

        if len(item) > 100:
            raise HTTPException(
                status_code=400,
                detail="Each list entry must be 100 characters or fewer.",
            )

        key = item.casefold()

        if key not in seen:
            cleaned.append(item)
            seen.add(key)

        if len(cleaned) >= limit:
            break

    return cleaned


def profile_to_dict(profile: dict | None, doctor_id: int) -> dict:
    """Return a consistent profile structure."""
    profile = profile or {}

    return {
        "doctor_id": doctor_id,
        "qualifications": profile.get("qualifications", ""),
        "specializations": profile.get("specializations", []),
        "experience_years": profile.get("experience_years", 0),
        "expertise_keywords": profile.get("expertise_keywords", []),
        "languages": profile.get("languages", []),
        "consultation_fee": profile.get("consultation_fee"),
        "available_days": profile.get("available_days", []),
        "is_available": profile.get("is_available", True),
        "updated_at": profile.get("updated_at"),
    }


def find_active_doctor(doctor_id: int):
    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    role_id = doctor_role["id"] if doctor_role else 1

    doctor = mongo_db.users.find_one({
        "_id": doctor_id,
        "role_id": role_id,
        "is_active": {"$in": [1, True]},
    })
    if not doctor:
        doctor = mongo_db.users.find_one({
            "id": doctor_id,
            "role_id": role_id,
            "is_active": {"$in": [1, True]},
        })

    if doctor is None:
        raise HTTPException(
            status_code=404,
            detail="Active doctor account not found.",
        )

    return doctor


# ---------------------------------------------------------
# ADMIN: LIST DOCTORS AND THEIR PROFILES
# ---------------------------------------------------------

@router.get("/admin/doctors")
def get_carematch_doctors(
    current_user=Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    role_id = doctor_role["id"] if doctor_role else 1

    doctors = list(
        mongo_db.users.find({
            "role_id": role_id,
            "is_active": {"$in": [1, True]},
        }).sort("full_name", 1)
    )

    try:
        profiles = {
            int(profile["doctor_id"]): profile
            for profile in mongo_db.doctor_profiles.find({})
            if profile.get("doctor_id") is not None
        }

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is unavailable. Check your MongoDB service.",
        ) from exc

    return {
        "count": len(doctors),
        "doctors": [
            {
                "id": doctor.get("id", doctor.get("_id")),
                "full_name": doctor.get("full_name"),
                "username": doctor.get("username"),
                "email": doctor.get("email"),
                "profile": profile_to_dict(
                    profiles.get(doctor.get("id", doctor.get("_id"))),
                    doctor.get("id", doctor.get("_id")),
                ),
                "profile_configured": doctor.get("id", doctor.get("_id")) in profiles,
            }
            for doctor in doctors
        ],
    }


# ---------------------------------------------------------
# ADMIN: CREATE OR UPDATE A DOCTOR PROFILE
# ---------------------------------------------------------

@router.put("/admin/doctors/{doctor_id}/profile")
@router.put("/admin/doctors/{doctor_id}")
def save_doctor_profile(
    doctor_id: int,
    request: DoctorProfileRequest,
    current_user=Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    doctor = find_active_doctor(doctor_id)
    doc_id = doctor.get("id", doctor.get("_id"))

    specializations = clean_list(request.specializations)
    expertise_keywords = clean_list(request.expertise_keywords)
    languages = clean_list(request.languages)
    available_days = clean_list(request.available_days, limit=7)

    allowed_days = {
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    }

    invalid_days = [
        day for day in available_days
        if day not in allowed_days
    ]

    if invalid_days:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid available_days. Use full weekday names, "
                "such as Monday or Friday."
            ),
        )

    now = datetime.utcnow()

    profile_data = {
        "doctor_id": doc_id,
        "qualifications": request.qualifications.strip(),
        "specializations": specializations,
        "experience_years": request.experience_years,
        "expertise_keywords": expertise_keywords,
        "languages": languages,
        "consultation_fee": request.consultation_fee,
        "available_days": available_days,
        "is_available": request.is_available,
        "updated_at": now,
    }

    try:
        mongo_db.doctor_profiles.update_one(
            {"doctor_id": doc_id},
            {
                "$set": profile_data,
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not save the doctor profile to MongoDB.",
        ) from exc

    return {
        "message": "Doctor profile saved successfully.",
        "doctor": {
            "id": doc_id,
            "full_name": doctor.get("full_name"),
            "username": doctor.get("username"),
        },
        "profile": profile_to_dict(
            profile_data,
            doc_id,
        ),
    }


# =========================================================
# CAREMATCH: RECOMMEND AVAILABLE DOCTORS
# =========================================================

@router.post("/recommendations")
def recommend_doctors(
    request: dict,
    current_user=Depends(
        require_permission("REGISTER_PATIENT")
    ),
):
    """
    Suggest available doctors using their configured
    specializations and expertise keywords.

    This is a routing aid, not a diagnosis.
    """

    raw_reason = ""
    for field in ("visit_reason", "chief_complaint", "problem_category"):
        val = request.get(field)
        if val is not None and str(val).strip():
            raw_reason = str(val).strip()
            break

    reason = raw_reason

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Please select the patient's problem.",
        )

    if len(reason) > 1500:
        raise HTTPException(
            status_code=400,
            detail="Visit reason is too long.",
        )

    preferred_language = str(
        request.get("preferred_language") or ""
    ).strip().casefold()

    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    role_id = doctor_role["id"] if doctor_role else 1

    doctors = list(
        mongo_db.users.find({
            "role_id": role_id,
            "is_active": {"$in": [1, True]},
        }).sort("full_name", 1)
    )

    if not doctors:
        return {
            "count": 0,
            "recommendations": [],
            "message": "No active doctors are registered.",
        }

    doctor_ids = [
        d.get("id", d.get("_id"))
        for d in doctors
    ]

    try:
        profiles = list(
            mongo_db.doctor_profiles.find({
                "doctor_id": {"$in": doctor_ids},
                "is_available": True,
            })
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "MongoDB is unavailable. Check that the "
                "MongoDB service is running."
            ),
        ) from exc

    doctors_by_id = {
        d.get("id", d.get("_id")): d
        for d in doctors
    }

    reason_lower = reason.casefold()

    reason_words = set(
        re.findall(r"[a-z0-9]+", reason_lower)
    )

    recommendations = []

    for profile in profiles:
        doctor_id = profile.get("doctor_id")

        if doctor_id is None:
            continue

        doctor = doctors_by_id.get(int(doctor_id))

        if doctor is None:
            continue

        doc_id = doctor.get("id", doctor.get("_id"))
        doc_name = doctor.get("full_name")

        specializations = profile.get(
            "specializations", []
        )

        expertise = profile.get(
            "expertise_keywords", []
        )

        if isinstance(specializations, str):
            specializations = [
                item.strip()
                for item in specializations.split(",")
                if item.strip()
            ]

        if isinstance(expertise, str):
            expertise = [
                item.strip()
                for item in expertise.split(",")
                if item.strip()
            ]

        # Match the patient's preferred language.
        languages = profile.get("languages", [])

        if isinstance(languages, str):
            languages = [
                item.strip()
                for item in languages.split(",")
                if item.strip()
            ]

        language_match = bool(
            preferred_language
            and any(
                preferred_language == str(language).strip().casefold()
                for language in languages
            )
        )

        profile_terms = (
            specializations + expertise
        )

        matched_terms = []

        for term in profile_terms:
            term = str(term).strip()

            if not term:
                continue

            term_words = set(
                re.findall(
                    r"[a-z0-9]+",
                    term.casefold(),
                )
            )

            # A direct specialization or keyword phrase match.
            if (
                term.casefold() in reason_lower
                or reason_words.intersection(term_words)
            ):
                matched_terms.append(term)

        # Score reflects keyword overlap, not medical suitability.
        unique_matches = list(
            dict.fromkeys(matched_terms)
        )

        match_score = min(
            100,
            len(unique_matches) * 25,
        )

        if not unique_matches:
            match_reasons = [
                "No direct keyword match; review the doctor's profile."
            ]
        else:
            match_reasons = unique_matches[:5]

        recommendations.append({
            "doctor_id": doc_id,
            "full_name": doc_name,
            "qualifications": profile.get(
                "qualifications", ""
            ),
            "specializations": specializations,
            "expertise_keywords": expertise,
            "languages": languages,
            "language_match": language_match,
            "experience_years": profile.get(
                "experience_years", 0
            ),
            "consultation_fee": profile.get(
                "consultation_fee"
            ),
            "match_score": match_score,
            "match_reasons": match_reasons,
        })

    recommendations.sort(
        key=lambda item: (
            -item["match_score"],
            -int(item["language_match"]),
            item["full_name"].casefold(),
        )
    )

    return {
        "count": len(recommendations),
        "recommendations": recommendations,
        "message": (
            None if recommendations else
            "No available doctor profiles found. "
            "Ask the administrator to configure doctor "
            "specializations and availability."
        ),
    }


# =========================================================
# CAREMATCH: SAVE APPOINTMENT
# =========================================================

@router.post("/appointments")
def save_carematch_appointment(
    request: dict,
    current_user=Depends(
        require_permission("REGISTER_PATIENT")
    ),
):
    """Save appointment metadata linked to patient records."""

    try:
        patient_id = int(request.get("patient_id"))
        encounter_id = int(request.get("encounter_id"))
        doctor_id = int(request.get("doctor_id"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Valid patient, encounter, and doctor IDs are required.",
        )

    visit_reason = str(
        request.get("visit_reason") or ""
    ).strip()

    appointment_date = str(
        request.get("appointment_date") or ""
    ).strip()

    appointment_time = str(
        request.get("appointment_time") or ""
    ).strip()

    if not visit_reason:
        raise HTTPException(
            status_code=400,
            detail="The reason for visit is required.",
        )

    if len(visit_reason) > 1500:
        raise HTTPException(
            status_code=400,
            detail="The reason for visit is too long.",
        )

    try:
        parsed_date = date.fromisoformat(appointment_date)
        parsed_time = datetime.strptime(
            appointment_time, "%H:%M"
        ).strftime("%H:%M")
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Use a valid appointment date and time.",
        ) from exc

    if parsed_date < date.today():
        raise HTTPException(
            status_code=400,
            detail="The appointment date cannot be in the past.",
        )

    # Confirm the patient exists in MongoDB.
    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": patient_id},
            {"id": patient_id},
        ]
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    actual_patient_id = patient.get("id", patient.get("_id"))

    # Confirm the encounter belongs to this patient in MongoDB.
    encounter = mongo_db.encounters.find_one({
        "$or": [
            {"_id": encounter_id},
            {"id": encounter_id},
        ]
    })

    if (
        encounter is None
        or encounter.get("patient_id") != actual_patient_id
    ):
        raise HTTPException(
            status_code=400,
            detail="The encounter does not belong to this patient.",
        )

    if (
        encounter.get("doctor_id") != doctor_id
        or encounter.get("status") != "ACTIVE"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected doctor does not match the active "
                "patient encounter."
            ),
        )

    # Confirm the doctor account is still active in MongoDB.
    doctor = find_active_doctor(doctor_id)
    doc_id = doctor.get("id", doctor.get("_id"))
    doc_name = doctor.get("full_name")

    # Recheck the doctor's current availability in MongoDB.
    try:
        profile = mongo_db.doctor_profiles.find_one({
            "doctor_id": doc_id,
            "is_available": True,
        })

        if profile is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This doctor is not currently marked available. "
                    "Please request fresh recommendations."
                ),
            )

        appointments = mongo_db.carematch_appointments

        # Prevent two bookings for the same doctor at the exact
        # same date and time.
        appointments.create_index(
            [
                ("doctor_id", 1),
                ("appointment_date", 1),
                ("appointment_time", 1),
            ],
            unique=True,
            name="unique_doctor_appointment_slot",
        )

        appointment_doc = {
            "patient_id": actual_patient_id,
            "encounter_id": encounter.get("id", encounter.get("_id")),
            "doctor_id": doc_id,
            "doctor_name": doc_name,
            "visit_reason": visit_reason,
            "appointment_date": parsed_date.isoformat(),
            "appointment_time": parsed_time,
            "status": "BOOKED",
            "created_by": current_user.id,
            "created_at": datetime.utcnow(),
        }

        saved = appointments.insert_one(appointment_doc)

    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail=(
                "This doctor already has an appointment at that "
                "exact date and time. Choose another slot."
            ),
        ) from exc

    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not save the appointment. Check MongoDB.",
        ) from exc

    return {
        "message": "Appointment saved successfully.",
        "appointment": {
            "id": str(saved.inserted_id),
            "patient_id": actual_patient_id,
            "encounter_id": encounter.get("id", encounter.get("_id")),
            "doctor_id": doc_id,
            "doctor_name": doc_name,
            "appointment_date": parsed_date.isoformat(),
            "appointment_time": parsed_time,
            "status": "BOOKED",
        },
    }
