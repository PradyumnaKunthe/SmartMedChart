from datetime import date, datetime
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, User
from app.security import require_permission


router = APIRouter(
    prefix="/api/hospital",
    tags=["Hospital Portal"],
)


# =========================================================
# Helpers
# =========================================================

def generate_patient_qr_token() -> str:
    """
    Generate a secure opaque QR token for a patient.
    """
    return token_urlsafe(32)


def parse_date_of_birth(value) -> date | None:
    """
    Convert a date value such as '1979-05-14'
    into a Python date object.
    """
    if value is None or str(value).strip() == "":
        return None

    if isinstance(value, date):
        return value

    try:
        return datetime.strptime(
            str(value).strip(),
            "%Y-%m-%d",
        ).date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid date_of_birth. "
                "Use YYYY-MM-DD format."
            ),
        )


def parse_weight(value):
    """
    Convert weight to a numeric value.
    """
    if value is None or str(value).strip() == "":
        return None

    try:
        weight = float(value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="weight_kg must be a valid number.",
        )

    if weight <= 0 or weight > 500:
        raise HTTPException(
            status_code=400,
            detail="weight_kg must be between 0 and 500.",
        )

    return weight


def parse_boolean(value, default=True) -> bool:
    """
    Safely convert incoming boolean-like values.
    """
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    text = str(value).strip().lower()

    if text in {"true", "1", "yes", "y", "active"}:
        return True

    if text in {"false", "0", "no", "n", "inactive"}:
        return False

    raise HTTPException(
        status_code=400,
        detail=f"Invalid boolean value: {value}",
    )


def patient_to_dict(patient: Patient) -> dict:
    """
    Convert a Patient SQLAlchemy object into a JSON-safe dictionary.
    """
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth,
        "gender": patient.gender,
        "weight_kg": (
            float(patient.weight_kg)
            if patient.weight_kg is not None
            else None
        ),
        "ward_id": patient.ward_id,
        "bed_id": patient.bed_id,
        "is_active": patient.is_active,
        "qr_is_active": patient.qr_is_active,
        "qr_generated_at": patient.qr_generated_at,
    }


# =========================================================
# Hospital dashboard
# =========================================================

@router.get("/dashboard")
def get_hospital_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return patient statistics for the Hospital Portal.
    """

    total_patient_count = (
        db.scalar(
            select(func.count(Patient.id))
        )
        or 0
    )

    active_patient_count = (
        db.scalar(
            select(
                func.count(Patient.id)
            ).where(
                Patient.is_active.is_(True)
            )
        )
        or 0
    )

    inactive_patient_count = (
        int(total_patient_count)
        - int(active_patient_count)
    )

    return {
        "message": (
            "Hospital dashboard generated successfully."
        ),
        "hospital": {
            "portal": "Hospital Data Portal",
            "status": "ACTIVE",
        },
        "patients": {
            "total": int(total_patient_count),
            "active": int(active_patient_count),
            "inactive": int(inactive_patient_count),
        },
    }


# =========================================================
# List / search patients
# =========================================================

@router.get("/patients")
def get_hospital_patients(
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Fetch patients from the shared SmartMedChart database.

    Supports searching by:
    - Patient ID
    - First name
    - Last name
    """

    if limit < 1:
        limit = 1

    if limit > 500:
        limit = 500

    query = select(Patient)

    if active_only:
        query = query.where(
            Patient.is_active.is_(True)
        )

    if search:
        search_value = search.strip()

        if search_value:
            pattern = f"%{search_value}%"

            query = query.where(
                or_(
                    Patient.patient_id.ilike(pattern),
                    Patient.first_name.ilike(pattern),
                    Patient.last_name.ilike(pattern),
                )
            )

    query = query.order_by(
        Patient.id.desc()
    ).limit(limit)

    patients = db.scalars(query).all()

    return {
        "count": len(patients),
        "patients": [
            patient_to_dict(patient)
            for patient in patients
        ],
    }


# =========================================================
# Get one patient
# =========================================================

@router.get("/patients/{patient_id}")
def get_hospital_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Fetch one patient by the internal database ID.
    """

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    return {
        "patient": patient_to_dict(patient)
    }


# =========================================================
# Create patient
# =========================================================

@router.post("/patients")
def create_hospital_patient(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Create a new patient in the shared SmartMedChart database.

    Required:
    - patient_id
    - first_name
    - last_name

    Optional:
    - date_of_birth
    - gender
    - weight_kg
    - ward_id
    - bed_id
    - is_active
    """

    # -----------------------------------------------------
    # Required fields
    # -----------------------------------------------------

    required_fields = [
        "patient_id",
        "first_name",
        "last_name",
    ]

    for field in required_fields:
        value = request.get(field)

        if value is None or str(value).strip() == "":
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required.",
            )

    # -----------------------------------------------------
    # Clean basic values
    # -----------------------------------------------------

    patient_code = str(
        request["patient_id"]
    ).strip()

    first_name = str(
        request["first_name"]
    ).strip()

    last_name = str(
        request["last_name"]
    ).strip()

    gender = request.get("gender")

    if gender is not None:
        gender = str(gender).strip()

    # -----------------------------------------------------
    # Validate date
    # -----------------------------------------------------

    date_of_birth = parse_date_of_birth(
        request.get("date_of_birth")
    )

    # -----------------------------------------------------
    # Validate weight
    # -----------------------------------------------------

    weight_kg = parse_weight(
        request.get("weight_kg")
    )

    # -----------------------------------------------------
    # Validate active status
    # -----------------------------------------------------

    is_active = parse_boolean(
        request.get("is_active"),
        default=True,
    )

    # -----------------------------------------------------
    # Ward / bed IDs
    # -----------------------------------------------------

    ward_id = request.get("ward_id")
    bed_id = request.get("bed_id")

    if ward_id in ("", None):
        ward_id = None

    if bed_id in ("", None):
        bed_id = None

    # -----------------------------------------------------
    # Check duplicate Patient ID
    # -----------------------------------------------------

    existing_patient = db.scalar(
        select(Patient).where(
            Patient.patient_id == patient_code
        )
    )

    if existing_patient is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "A patient with this Patient ID "
                "already exists."
            ),
        )

    # -----------------------------------------------------
    # Generate unique QR token
    # -----------------------------------------------------

    qr_token = generate_patient_qr_token()

    while (
        db.scalar(
            select(Patient).where(
                Patient.qr_token == qr_token
            )
        )
        is not None
    ):
        qr_token = generate_patient_qr_token()

    # -----------------------------------------------------
    # Create patient
    # -----------------------------------------------------

    patient = Patient(
        patient_id=patient_code,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date_of_birth,
        gender=gender,
        weight_kg=weight_kg,
        ward_id=ward_id,
        bed_id=bed_id,
        is_active=is_active,
        qr_token=qr_token,
        qr_generated_at=datetime.utcnow(),
        qr_is_active=True,
    )

    try:
        db.add(patient)
        db.commit()
        db.refresh(patient)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Patient could not be created because "
                "a unique database value already exists."
            ),
        )

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {
        "message": "Patient created successfully.",
        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "weight_kg": (
                float(patient.weight_kg)
                if patient.weight_kg is not None
                else None
            ),
            "ward_id": patient.ward_id,
            "bed_id": patient.bed_id,
            "is_active": patient.is_active,
            "qr_is_active": patient.qr_is_active,
            "qr_generated_at": patient.qr_generated_at,
        },
    }


# =========================================================
# Regenerate patient QR
# =========================================================

@router.post(
    "/patients/{patient_id}/qr/regenerate"
)
def regenerate_patient_qr(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Generate a new QR token for an existing patient.
    """

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    qr_token = generate_patient_qr_token()

    while (
        db.scalar(
            select(Patient).where(
                Patient.qr_token == qr_token
            )
        )
        is not None
    ):
        qr_token = generate_patient_qr_token()

    patient.qr_token = qr_token
    patient.qr_generated_at = datetime.utcnow()
    patient.qr_is_active = True

    db.commit()
    db.refresh(patient)

    return {
        "message": (
            "Patient QR token regenerated successfully."
        ),
        "patient_id": patient.id,
        "qr_generated_at": patient.qr_generated_at,
        "qr_is_active": patient.qr_is_active,
    }