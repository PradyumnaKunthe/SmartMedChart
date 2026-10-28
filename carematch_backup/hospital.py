from datetime import date, datetime
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Bed,
    Encounter,
    Patient,
    PatientBilling,
    Role,
    User,
    Ward,
)
from app.security import require_permission


router = APIRouter(
    prefix="/api/hospital",
    tags=["Hospital Portal"],
)


# =========================================================
# HELPERS
# =========================================================

def generate_patient_qr_token() -> str:
    """
    Generate a secure opaque QR token for a patient.
    """
    return token_urlsafe(32)


def generate_patient_id(db: Session) -> str:
    """
    Automatically generate a unique SmartMedChart Patient ID.

    Format:
        SMH-PUN-YYMMDD-XXXX
    """
    today = date.today()
    date_code = today.strftime("%y%m%d")
    prefix = f"SMH-PUN-{date_code}-"

    sequence = 1

    while True:
        patient_code = f"{prefix}{sequence:04d}"

        existing_patient = db.scalar(
            select(Patient).where(
                Patient.patient_id == patient_code
            )
        )

        if existing_patient is None:
            return patient_code

        sequence += 1


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
    Convert a Patient SQLAlchemy object into
    a JSON-safe dictionary.
    """
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "full_name": (
            f"{patient.first_name} "
            f"{patient.last_name}"
        ).strip(),
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
# HOSPITAL DASHBOARD
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
# LIST / SEARCH PATIENTS
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

    query = (
        query
        .order_by(Patient.id.desc())
        .limit(limit)
    )

    patients = db.scalars(query).all()

    return {
        "count": len(patients),
        "patients": [
            patient_to_dict(patient)
            for patient in patients
        ],
    }


# =========================================================
# GET ONE PATIENT - COMPLETE PROFILE
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
    Return the complete hospital patient profile.

    Includes:
    - Patient information
    - Ward information
    - Bed information
    - Latest encounter
    - Attending doctor
    - Billing
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

    # -----------------------------------------------------
    # Latest encounter
    # -----------------------------------------------------
    encounter = db.scalar(
        select(Encounter)
        .where(
            Encounter.patient_id == patient.id
        )
        .order_by(
            desc(Encounter.created_at)
        )
    )

    # -----------------------------------------------------
    # Doctor
    # -----------------------------------------------------
    doctor = None

    if (
        encounter is not None
        and encounter.doctor_id is not None
    ):
        doctor = db.scalar(
            select(User).where(
                User.id == encounter.doctor_id
            )
        )

    # -----------------------------------------------------
    # Ward
    # -----------------------------------------------------
    ward = None

    if patient.ward_id is not None:
        ward = db.scalar(
            select(Ward).where(
                Ward.id == patient.ward_id
            )
        )

    # -----------------------------------------------------
    # Bed
    # -----------------------------------------------------
    bed = None

    if patient.bed_id is not None:
        bed = db.scalar(
            select(Bed).where(
                Bed.id == patient.bed_id
            )
        )

    # -----------------------------------------------------
    # Billing
    # -----------------------------------------------------
    billing = db.scalar(
        select(PatientBilling)
        .where(
            PatientBilling.patient_id == patient.id
        )
        .order_by(
            desc(PatientBilling.created_at)
        )
    )

    return {
        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,

            "first_name": patient.first_name,
            "last_name": patient.last_name,

            "full_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),

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

            "ward": (
                {
                    "id": ward.id,
                    "name": ward.name,
                    "code": ward.code,
                    "description": ward.description,
                    "is_active": ward.is_active,
                }
                if ward is not None
                else None
            ),

            "bed": (
                {
                    "id": bed.id,
                    "bed_number": bed.bed_number,
                    "ward_id": bed.ward_id,
                    "is_active": bed.is_active,
                    "is_occupied": bed.is_occupied,
                }
                if bed is not None
                else None
            ),

            "encounter": (
                {
                    "id": encounter.id,
                    "doctor_id": encounter.doctor_id,
                    "doctor_name": (
                        doctor.full_name
                        if doctor is not None
                        else None
                    ),
                    "encounter_type": encounter.encounter_type,
                    "status": encounter.status,
                    "admitted_at": encounter.admitted_at,
                    "discharged_at": encounter.discharged_at,
                    "discharge_reason": encounter.discharge_reason,
                }
                if encounter is not None
                else None
            ),

            "doctor": (
                {
                    "id": doctor.id,
                    "full_name": doctor.full_name,
                    "username": doctor.username,
                    "email": doctor.email,
                }
                if doctor is not None
                else None
            ),

            "billing": (
                {
                    "id": billing.id,
                    "bill_status": billing.bill_status,
                    "bill_amount": (
                        float(billing.bill_amount)
                        if billing.bill_amount is not None
                        else None
                    ),
                    "paid_at": billing.paid_at,
                    "paid_by": billing.paid_by,
                    "created_at": billing.created_at,
                    "updated_at": billing.updated_at,
                }
                if billing is not None
                else None
            ),
        }
    }


# =========================================================
# LIST ACTIVE DOCTORS
# =========================================================

@router.get("/doctors")
def get_hospital_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return all active registered doctors.

    Doctors are automatically taken from the Staff
    Management users table.
    """
    doctors = db.scalars(
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(
            Role.name == "Doctor",
            User.is_active.is_(True),
        )
        .order_by(User.full_name.asc())
    ).all()

    return {
        "count": len(doctors),
        "doctors": [
            {
                "id": doctor.id,
                "full_name": doctor.full_name,
                "username": doctor.username,
                "email": doctor.email,
            }
            for doctor in doctors
        ],
    }


# =========================================================
# CREATE / REGISTER PATIENT
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
    Register a new patient.

    Automatically creates:
    - Patient master record
    - Initial Encounter
    - Initial Billing record
    - Active QR token

    Patient ID is generated automatically.

    Required:
    - first_name
    - last_name
    - doctor_id

    Optional admission:
    - is_admitted
    - ward_id
    - bed_id
    """

    # -----------------------------------------------------
    # Required fields
    # -----------------------------------------------------
    required_fields = [
        "first_name",
        "last_name",
        "doctor_id",
    ]

    for field in required_fields:
        value = request.get(field)

        if (
            value is None
            or str(value).strip() == ""
        ):
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required.",
            )

    # -----------------------------------------------------
    # Basic values
    # -----------------------------------------------------
    first_name = str(
        request["first_name"]
    ).strip()

    last_name = str(
        request["last_name"]
    ).strip()

    gender = request.get("gender")

    if gender is not None:
        gender = str(gender).strip() or None

    # -----------------------------------------------------
    # Date of birth
    # -----------------------------------------------------
    date_of_birth = parse_date_of_birth(
        request.get("date_of_birth")
    )

    # -----------------------------------------------------
    # Weight
    # -----------------------------------------------------
    weight_kg = parse_weight(
        request.get("weight_kg")
    )

    # -----------------------------------------------------
    # Doctor
    # -----------------------------------------------------
    doctor_id = request.get("doctor_id")

    try:
        doctor_id = int(doctor_id)

    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="doctor_id must be a valid integer.",
        )

    doctor = db.scalar(
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(
            User.id == doctor_id,
            User.is_active.is_(True),
            Role.name == "Doctor",
        )
    )

    if doctor is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Selected doctor is not an active "
                "registered doctor."
            ),
        )

    # -----------------------------------------------------
    # Admission state
    # -----------------------------------------------------
    is_admitted = parse_boolean(
        request.get("is_admitted"),
        default=False,
    )

    # -----------------------------------------------------
    # Ward / bed
    # -----------------------------------------------------
    ward_id = request.get("ward_id")
    bed_id = request.get("bed_id")

    if ward_id in ("", None):
        ward_id = None

    if bed_id in ("", None):
        bed_id = None

    if is_admitted and ward_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Ward is required when admitting "
                "a patient."
            ),
        )

    if is_admitted and bed_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Bed is required when admitting "
                "a patient."
            ),
        )

    if not is_admitted:
        ward_id = None
        bed_id = None

    # -----------------------------------------------------
    # Validate ward / bed
    # -----------------------------------------------------
    selected_bed = None

    if bed_id is not None:
        try:
            ward_id = (
                int(ward_id)
                if ward_id is not None
                else None
            )

            bed_id = int(bed_id)

        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=(
                    "ward_id and bed_id must be "
                    "valid integers."
                ),
            )

        selected_bed = db.scalar(
            select(Bed).where(
                Bed.id == bed_id,
                Bed.is_active.is_(True),
            )
        )

        if selected_bed is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Selected bed not found or inactive."
                ),
            )

        if selected_bed.is_occupied:
            raise HTTPException(
                status_code=409,
                detail="Selected bed is already occupied.",
            )

        if (
            ward_id is not None
            and selected_bed.ward_id != ward_id
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Selected bed does not belong "
                    "to the selected ward."
                ),
            )

    # -----------------------------------------------------
    # Generate Patient ID
    # -----------------------------------------------------
    patient_code = generate_patient_id(db)

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

    now = datetime.utcnow()

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
        is_active=True,
        qr_token=qr_token,
        qr_generated_at=now,
        qr_is_active=True,
    )

    try:
        db.add(patient)

        # Flush so patient.id becomes available.
        db.flush()

        # -------------------------------------------------
        # Create initial encounter
        # -------------------------------------------------
        encounter = Encounter(
            patient_id=patient.id,
            doctor_id=doctor_id,
            encounter_type=(
                "INPATIENT"
                if is_admitted
                else "OPD"
            ),
            status="ACTIVE",
            admitted_at=(
                now
                if is_admitted
                else None
            ),
            created_at=now,
            updated_at=now,
        )

        db.add(encounter)

        # -------------------------------------------------
        # Create initial billing record
        # -------------------------------------------------
        billing = PatientBilling(
            patient_id=patient.id,
            bill_status="PENDING",
            bill_amount=None,
            created_at=now,
            updated_at=now,
        )

        db.add(billing)

        # -------------------------------------------------
        # Occupy bed
        # -------------------------------------------------
        if selected_bed is not None:
            selected_bed.is_occupied = True
            selected_bed.updated_at = now

        db.commit()

        db.refresh(patient)
        db.refresh(encounter)
        db.refresh(billing)

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Patient could not be created because "
                "a unique database value already exists."
            ),
        ) from exc

    return {
        "message": "Patient registered successfully.",

        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "full_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),
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

        "encounter": {
            "id": encounter.id,
            "doctor_id": encounter.doctor_id,
            "doctor_name": (
                encounter.doctor.full_name
                if encounter.doctor is not None
                else doctor.full_name
            ),
            "encounter_type": encounter.encounter_type,
            "status": encounter.status,
            "admitted_at": encounter.admitted_at,
        },

        "billing": {
            "id": billing.id,
            "bill_status": billing.bill_status,
            "bill_amount": (
                float(billing.bill_amount)
                if billing.bill_amount is not None
                else None
            ),
        },
    }


# =========================================================
# REGENERATE PATIENT QR
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
    Generate a new QR token for an active patient.
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

    # A discharged patient must never receive
    # a newly activated QR code.
    if not patient.is_active:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot regenerate QR for a "
                "discharged patient."
            ),
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
    patient.updated_at = datetime.utcnow()

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
