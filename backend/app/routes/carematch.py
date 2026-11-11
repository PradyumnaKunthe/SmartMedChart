from datetime import date, datetime
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.mongo_client import mongo_db
from app.security import get_current_user, require_permission


router = APIRouter(
    prefix="/api/carematch",
    tags=["CareMatch"],
)


# ---------------------------------------------------------
# REQUEST MODEL
# ---------------------------------------------------------

class DoctorProfileRequest(BaseModel):
    qualifications: str | list[str] = Field(default="")
    specializations: list[str] = Field(default_factory=list)
    experience_years: int = Field(default=0, ge=0, le=80)
    expertise_keywords: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    consultation_fee: float | None = Field(default=None, ge=0)
    available_days: list[str] = Field(default_factory=list)
    is_available: bool = True


# ---------------------------------------------------------
# MEDICAL TAXONOMY & SYNONYMS
# ---------------------------------------------------------

CATEGORY_TO_SPECIALTY = {
    "CARDIOLOGY": ["cardiology", "cardiothoracic surgery"],
    "PEDIATRICS": ["pediatrics", "neonatology", "pediatric surgery"],
    "DERMATOLOGY": ["dermatology"],
    "ORTHOPEDICS": ["orthopedics", "rheumatology"],
    "NEUROLOGY": ["neurology", "neurosurgery"],
    "GYNECOLOGY": ["obstetrics and gynecology", "fertility and ivf"],
    "OBSTETRICS AND GYNECOLOGY": ["obstetrics and gynecology", "fertility and ivf"],
    "GASTROENTEROLOGY": ["gastroenterology", "hepatology"],
    "PULMONOLOGY": ["pulmonology", "respiratory medicine"],
    "ENT": ["ent"],
    "OPHTHALMOLOGY": ["ophthalmology"],
    "ENDOCRINOLOGY": ["endocrinology", "diabetology"],
    "UROLOGY": ["urology"],
    "NEPHROLOGY": ["nephrology"],
    "PSYCHIATRY": ["psychiatry"],
    "DENTISTRY": ["dentistry", "oral surgery"],
    "GENERAL MEDICINE": ["general medicine", "internal medicine", "family medicine"],
}

SYMPTOM_SPECIALTY_MAP = {
    "cardiology": [
        "heart", "chest pain", "angina", "cardiac", "palpitations", "arrhythmia",
        "coronary", "hypertension", "high blood pressure", "cholesterol",
        "tachycardia", "bradycardia", "cardiothoracic", "heart attack", "ecg"
    ],
    "pediatrics": [
        "child", "infant", "baby", "toddler", "pediatric", "pediatrics",
        "childhood", "vaccination", "immunization", "newborn", "neonate",
        "growth and development", "child health", "pediatrician", "measles",
        "mumps", "chickenpox"
    ],
    "dermatology": [
        "skin", "rash", "acne", "itching", "eczema", "psoriasis", "dermatitis",
        "hives", "urticaria", "hair loss", "alopecia", "skin infection",
        "boil", "blister", "mole", "wart", "fungal", "ringworm", "scalp"
    ],
    "orthopedics": [
        "bone", "fracture", "joint", "joint pain", "knee", "knee pain",
        "back pain", "spine", "arthritis", "ligament", "sprain", "dislocation",
        "shoulder", "hip", "neck pain", "musculoskeletal", "tendon"
    ],
    "neurology": [
        "headache", "migraine", "dizziness", "vertigo", "seizure", "epilepsy",
        "stroke", "paralysis", "numbness", "tingling", "nerve", "neuropathy",
        "tremor", "parkinson", "memory loss", "dementia", "confusion"
    ],
    "gastroenterology": [
        "stomach", "abdomen", "abdominal pain", "acidity", "acid reflux", "gerd",
        "heartburn", "vomiting", "nausea", "diarrhea", "constipation", "gastric",
        "gastritis", "ulcer", "liver", "hepatitis", "jaundice", "bloating", "ibs"
    ],
    "pulmonology": [
        "lung", "lungs", "cough", "asthma", "bronchitis", "wheezing", "chest congestion",
        "phlegm", "sputum", "pneumonia", "copd", "respiratory", "shortness of breath",
        "breathing difficulty"
    ],
    "obstetrics and gynecology": [
        "pregnancy", "pregnant", "period", "periods", "menstrual", "menstruation",
        "cramps", "pcos", "pcod", "vaginal", "pelvic pain", "gynecology",
        "obstetrics", "infertility", "fertility", "ivf", "ovary", "uterus"
    ],
    "ent": [
        "ear", "ear pain", "hearing", "throat", "sore throat", "tonsil",
        "tonsillitis", "nose", "nasal", "sinus", "sinusitis", "hoarseness",
        "ear discharge", "tinnitus", "deviated septum"
    ],
    "ophthalmology": [
        "eye", "eyes", "vision", "blurry vision", "cataract", "glaucoma",
        "conjunctivitis", "red eye", "cornea", "eye pain", "sight"
    ],
    "endocrinology": [
        "diabetes", "blood sugar", "glucose", "thyroid", "hypothyroidism",
        "hyperthyroidism", "goiter", "hormone", "hormonal", "endocrine",
        "metabolic", "diabetology"
    ],
    "urology": [
        "urine", "urinary", "uti", "burning urination", "kidney stone",
        "kidney stones", "frequent urination", "bladder", "prostate",
        "incontinence", "dysuria", "hematuria", "urology"
    ],
    "nephrology": [
        "kidney", "renal", "kidney disease", "kidney failure", "dialysis",
        "creatinine", "nephrology", "proteinuria", "swelling in legs"
    ],
    "psychiatry": [
        "depression", "anxiety", "panic", "insomnia", "sleep disorder",
        "sleep disorders", "bipolar", "mental health", "stress",
        "hallucinations", "psychosis", "adhd", "ocd"
    ],
    "dentistry": [
        "tooth", "teeth", "dental", "toothache", "gum", "gums", "cavity",
        "root canal", "jaw pain", "dentist", "oral health"
    ],
    "general medicine": [
        "fever", "weakness", "fatigue", "body ache", "malaise", "viral",
        "infection", "routine checkup", "general checkup", "preventive health",
        "loss of appetite", "dehydration"
    ],
}

EMERGENCY_PATTERNS = [
    r"\bcrushing\s+chest\s+pain\b",
    r"\bheart\s+attack\b",
    r"\bmyocardial\s+infarction\b",
    r"\bcardiac\s+arrest\b",
    r"\bchest\s+pain\b.*?\b(radiat|jaw|arm|sweat|breath|shortness)\b",
    r"\b(severe|acute)\s+shortness\s+of\s+breath\b",
    r"\bdifficulty\s+breathing\b",
    r"\bunable\s+to\s+breathe\b",
    r"\basphyxi\b",
    r"\bstridor\b",
    r"\bcyanosis\b",
    r"\bunconscious\b",
    r"\bunresponsive\b",
    r"\bcoma\b",
    r"\bpassed\s+out\b",
    r"\bstroke\b",
    r"\bparalysis\b",
    r"\bslurred\s+speech\b",
    r"\bfacial\s+droop\b",
    r"\bsudden\s+numbness\b",
    r"\bsevere\s+bleeding\b",
    r"\buncontrollable\s+bleeding\b",
    r"\bhemorrhag\b",
    r"\bvomiting\s+blood\b",
    r"\bcoughing\s+up\s+blood\b",
    r"\banaphylax\b",
    r"\bstatus\s+epilepticus\b",
    r"\bcontinuous\s+seizure\b",
]


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def require_admin_permission(current_user):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }
    if not ({"MANAGE_USERS", "MANAGE_SYSTEM"} & permission_names):
        raise HTTPException(
            status_code=403,
            detail="Administrator permission required.",
        )


def require_carematch_permission(current_user=Depends(get_current_user)):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }
    allowed = {"REGISTER_PATIENT", "MANAGE_USERS", "MANAGE_SYSTEM", "VIEW_PATIENT"}
    if not (permission_names & allowed):
        raise HTTPException(
            status_code=403,
            detail="Permission required to access CareMatch recommendations.",
        )
    return current_user


def clean_list(values: list[str], limit: int = 30) -> list[str]:
    """Trim entries and remove duplicates."""
    cleaned = []
    seen = set()

    for value in values:
        item = str(value).strip()

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

    quals = profile.get("qualifications", [])
    if isinstance(quals, str):
        quals = [q.strip() for q in quals.split(",") if q.strip()]

    return {
        "doctor_id": doctor_id,
        "qualifications": quals,
        "specializations": profile.get("specializations", []),
        "experience_years": profile.get("experience_years", 0),
        "expertise_keywords": profile.get("expertise_keywords", []),
        "languages": profile.get("languages", []),
        "consultation_fee": profile.get("consultation_fee"),
        "available_days": profile.get("available_days", []),
        "is_available": profile.get("is_available", True),
        "created_at": profile.get("created_at"),
        "updated_at": profile.get("updated_at"),
    }


def find_active_doctor(doctor_id: int):
    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    doctor_role_ids = [1]
    if doctor_role:
        doctor_role_ids.extend([doctor_role.get("id"), doctor_role.get("_id")])
    doctor_role_ids = list(set([r for r in doctor_role_ids if r is not None]))

    doctor = mongo_db.users.find_one({
        "_id": doctor_id,
        "role_id": {"$in": doctor_role_ids},
        "is_active": {"$in": [1, True, "1", "true"]},
    })
    if not doctor:
        doctor = mongo_db.users.find_one({
            "id": doctor_id,
            "role_id": {"$in": doctor_role_ids},
            "is_active": {"$in": [1, True, "1", "true"]},
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
    current_user=Depends(get_current_user),
):
    require_admin_permission(current_user)

    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    doctor_role_ids = [1]
    if doctor_role:
        doctor_role_ids.extend([doctor_role.get("id"), doctor_role.get("_id")])
    doctor_role_ids = list(set([r for r in doctor_role_ids if r is not None]))

    doctors = list(
        mongo_db.users.find({
            "role_id": {"$in": doctor_role_ids},
            "is_active": {"$in": [1, True, "1", "true"]},
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
    current_user=Depends(get_current_user),
):
    require_admin_permission(current_user)

    doctor = find_active_doctor(doctor_id)
    doc_id = doctor.get("id", doctor.get("_id"))

    if isinstance(request.qualifications, list):
        qualifications = clean_list(request.qualifications)
    elif isinstance(request.qualifications, str):
        qualifications = clean_list([q.strip() for q in request.qualifications.split(",") if q.strip()])
    else:
        qualifications = []

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
        "qualifications": qualifications,
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
    current_user=Depends(require_carematch_permission),
):
    """
    Suggest available doctors using clinical specializations, expertise keywords,
    and linguistic matching. Includes high-acuity emergency escalation detection.
    """

    problem_category = str(request.get("problem_category") or "").strip().upper()
    chief_complaint = str(request.get("chief_complaint") or "").strip()
    visit_reason = str(request.get("visit_reason") or "").strip()
    symptoms = str(request.get("symptoms") or "").strip()
    preferred_language = str(request.get("preferred_language") or "").strip().casefold()
    symptom_severity = str(request.get("symptom_severity") or "").strip().upper()

    combined_text = f"{problem_category} {chief_complaint} {visit_reason} {symptoms}".strip()

    if not combined_text:
        return {
            "count": 0,
            "recommendations": [],
            "emergency_escalation": False,
            "emergency_warning": None,
            "message": "Please enter the patient's symptoms or select a problem category to find matching doctors.",
        }

    if len(combined_text) > 3000:
        raise HTTPException(
            status_code=400,
            detail="Visit complaint details are too long.",
        )

    search_text_lower = combined_text.casefold()

    # 1. EMERGENCY / HIGH-ACUITY DETECTION
    emergency_escalation = False
    emergency_warning = None

    for pattern in EMERGENCY_PATTERNS:
        if re.search(pattern, search_text_lower):
            emergency_escalation = True
            break

    if not emergency_escalation and symptom_severity == "SEVERE":
        severe_red_flags = ["chest", "heart", "breath", "seizure", "stroke", "bleeding", "unconscious", "head injury"]
        if any(flag in search_text_lower for flag in severe_red_flags):
            emergency_escalation = True

    if emergency_escalation:
        emergency_warning = (
            "CRITICAL CLINICAL ALERT: Symptoms indicate a potentially life-threatening emergency. "
            "Immediate triage and emergency medical care are strongly recommended. "
            "Do not delay emergency evaluation for routine clinic routing."
        )

    # 2. LOAD ACTIVE DOCTORS
    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    doctor_role_ids = [1]
    if doctor_role:
        doctor_role_ids.extend([doctor_role.get("id"), doctor_role.get("_id")])
    doctor_role_ids = list(set([r for r in doctor_role_ids if r is not None]))

    doctors = list(
        mongo_db.users.find({
            "role_id": {"$in": doctor_role_ids},
            "is_active": {"$in": [1, True, "1", "true"]},
        }).sort("full_name", 1)
    )

    if not doctors:
        return {
            "count": 0,
            "recommendations": [],
            "emergency_escalation": emergency_escalation,
            "emergency_warning": emergency_warning,
            "message": "No active doctors are registered in the hospital system.",
        }

    doctor_ids = [d.get("id", d.get("_id")) for d in doctors]

    try:
        # Strictly query profiles where is_available is True
        profiles = list(
            mongo_db.doctor_profiles.find({
                "doctor_id": {"$in": doctor_ids},
                "is_available": True,
            })
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is unavailable. Check that the MongoDB service is running.",
        ) from exc

    doctors_by_id = {d.get("id", d.get("_id")): d for d in doctors}

    # 3. IDENTIFY TARGET SPECIALTIES FROM CATEGORY AND COMPLAINT
    target_specialties = set()

    # From explicit problem category
    if problem_category and problem_category != "OTHER / NOT SURE":
        if problem_category in CATEGORY_TO_SPECIALTY:
            target_specialties.update(CATEGORY_TO_SPECIALTY[problem_category])
        else:
            cat_norm = problem_category.casefold()
            for key, val in CATEGORY_TO_SPECIALTY.items():
                if cat_norm in key.casefold() or any(cat_norm in s for s in val):
                    target_specialties.update(val)

    # From symptom keywords
    for specialty_key, keywords in SYMPTOM_SPECIALTY_MAP.items():
        for kw in keywords:
            # Check whole word / phrase match
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, search_text_lower):
                target_specialties.add(specialty_key)
                break

    recommendations = []

    for profile in profiles:
        doc_id = profile.get("doctor_id")
        if doc_id is None:
            continue

        doctor = doctors_by_id.get(int(doc_id))
        if doctor is None:
            continue

        doc_name = doctor.get("full_name")

        specializations = profile.get("specializations", [])
        if isinstance(specializations, str):
            specializations = [s.strip() for s in specializations.split(",") if s.strip()]

        expertise_keywords = profile.get("expertise_keywords", [])
        if isinstance(expertise_keywords, str):
            expertise_keywords = [e.strip() for e in expertise_keywords.split(",") if e.strip()]

        languages = profile.get("languages", [])
        if isinstance(languages, str):
            languages = [l.strip() for l in languages.split(",") if l.strip()]

        experience_years = int(profile.get("experience_years", 0) or 0)

        match_reasons = []

        # --- A. SPECIALTY SCORING (up to 50 pts) ---
        specialty_score = 0
        matched_spec_names = []

        for spec in specializations:
            spec_lower = spec.casefold()
            # Direct match with identified target specialties
            if any(target in spec_lower or spec_lower in target for target in target_specialties):
                matched_spec_names.append(spec)
            elif spec_lower in search_text_lower:
                matched_spec_names.append(spec)

        if matched_spec_names:
            specialty_score = 45
            for m in matched_spec_names[:2]:
                match_reasons.append(f"Specialist in {m}")
        elif problem_category in ("GENERAL MEDICINE", "OTHER / NOT SURE", ""):
            # Fallback for General Medicine
            if any("general medicine" in s.casefold() or "internal medicine" in s.casefold() or "family medicine" in s.casefold() for s in specializations):
                specialty_score = 30
                match_reasons.append("General Medicine primary care specialist")

        # --- B. EXPERTISE KEYWORDS SCORING (up to 30 pts) ---
        expertise_score = 0
        matched_exp_names = []

        for kw in expertise_keywords:
            kw_clean = kw.strip()
            if not kw_clean:
                continue
            kw_lower = kw_clean.casefold()
            pattern = r"\b" + re.escape(kw_lower) + r"\b"
            if re.search(pattern, search_text_lower) or kw_lower in search_text_lower:
                matched_exp_names.append(kw_clean)
                expertise_score += 15

        expertise_score = min(30, expertise_score)
        for m in matched_exp_names[:2]:
            match_reasons.append(f"Clinical expertise in {m}")

        # --- C. CLINICAL RELEVANCE GATE ---
        # If there is no specialty match and no expertise keyword match, doctor is clinically non-relevant!
        if specialty_score == 0 and expertise_score == 0:
            continue

        # --- D. LANGUAGE MATCH (up to 10 pts) ---
        language_match = False
        language_score = 0
        if preferred_language:
            for lang in languages:
                if preferred_language == str(lang).strip().casefold():
                    language_match = True
                    language_score = 10
                    match_reasons.append(f"Fluent in {lang.title()}")
                    break

        # --- E. EXPERIENCE BONUS (up to 10 pts) ---
        experience_bonus = min(10, max(1, experience_years // 3))
        if experience_years >= 3:
            match_reasons.append(f"{experience_years} years clinical experience")

        # Total Match Score
        total_score = min(98, specialty_score + expertise_score + language_score + experience_bonus)

        # Deduplicate reasons
        unique_reasons = list(dict.fromkeys(match_reasons))[:4]
        if not unique_reasons:
            unique_reasons = ["Relevant clinical profile for this patient"]

        recommendations.append({
            "doctor_id": doc_id,
            "full_name": doc_name,
            "qualifications": profile.get("qualifications", []),
            "specializations": specializations,
            "expertise_keywords": expertise_keywords,
            "languages": languages,
            "language_match": language_match,
            "experience_years": experience_years,
            "consultation_fee": profile.get("consultation_fee"),
            "match_score": total_score,
            "match_reasons": unique_reasons,
            "is_available": True,
        })

    # Sort: match_score DESC, language_match DESC, experience_years DESC, full_name ASC
    recommendations.sort(
        key=lambda item: (
            -item["match_score"],
            -int(item["language_match"]),
            -item["experience_years"],
            item["full_name"].casefold(),
        )
    )

    message = None
    if not recommendations:
        message = (
            "No matching specialists found for this complaint. "
            "Please select an available doctor from the hospital roster below."
        )
    else:
        message = f"{len(recommendations)} matching specialist(s) identified by CareMatch AI."

    return {
        "count": len(recommendations),
        "recommendations": recommendations,
        "emergency_escalation": emergency_escalation,
        "emergency_warning": emergency_warning,
        "message": message,
    }


# =========================================================
# CAREMATCH: SAVE APPOINTMENT
# =========================================================

@router.post("/appointments")
def save_carematch_appointment(
    request: dict,
    current_user=Depends(require_carematch_permission),
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

    if not (patient.get("is_active") in (True, 1)) or patient.get("lifecycle_status") == "DISCHARGED":
        raise HTTPException(
            status_code=400,
            detail="Cannot book an appointment for a discharged or inactive patient.",
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


def init_carematch_indexes():
    """Ensure unique doctor appointment slot index exists in MongoDB."""
    try:
        mongo_db.carematch_appointments.create_index(
            [
                ("doctor_id", 1),
                ("appointment_date", 1),
                ("appointment_time", 1),
            ],
            unique=True,
            name="unique_doctor_appointment_slot",
        )
    except Exception:
        pass

