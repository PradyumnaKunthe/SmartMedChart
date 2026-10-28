from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Bed,
    Encounter,
    NursePatientAssignment,
    Patient,
    PatientBilling,
    Role,
    User,
    Ward,
)
from app.schemas.admin import (
    AssignmentCreateRequest,
    StaffCreateRequest,
)
from app.security import hash_password, require_permission


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


# =========================================================
# HELPERS
# =========================================================

def require_admin_permission(
    current_user: User,
):
    permission_names = {
        permission.name
        for permission in current_user.role.permissions
    }

    if "MANAGE_USERS" not in permission_names:
        raise HTTPException(
            status_code=403,
            detail="Administrator permission required.",
        )


def serialize_staff(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.name,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


def get_role(
    db: Session,
    role_name: str,
):
    role = db.scalar(
        select(Role).where(
            Role.name == role_name
        )
    )

    if role is None:
        raise HTTPException(
            status_code=500,
            detail=f"Role '{role_name}' does not exist.",
        )

    return role


# =========================================================
# STAFF
# =========================================================

@router.get("/staff")
def get_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    users = db.scalars(
        select(User)
        .order_by(
            User.full_name,
            User.username,
        )
    ).all()

    return {
        "staff": [
            serialize_staff(user)
            for user in users
        ]
    }


@router.get("/nurses")
def get_nurses(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    nurse_role = get_role(
        db,
        "Nurse",
    )

    nurses = db.scalars(
        select(User)
        .where(
            User.role_id == nurse_role.id,
            User.is_active.is_(True),
        )
        .order_by(
            User.full_name
        )
    ).all()

    return {
        "nurses": [
            serialize_staff(nurse)
            for nurse in nurses
        ]
    }


@router.get("/doctors")
def get_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    doctor_role = get_role(
        db,
        "Doctor",
    )

    doctors = db.scalars(
        select(User)
        .where(
            User.role_id == doctor_role.id,
            User.is_active.is_(True),
        )
        .order_by(
            User.full_name
        )
    ).all()

    return {
        "doctors": [
            serialize_staff(doctor)
            for doctor in doctors
        ]
    }


@router.post("/staff")
def create_staff(
    request: StaffCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    role_name = request.role.strip().lower()

    if role_name == "nurse":
        actual_role_name = "Nurse"
    elif role_name == "doctor":
        actual_role_name = "Doctor"
    elif role_name == "receptionist":
        actual_role_name = "Receptionist"
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only Nurse, Doctor, and Receptionist "
                "accounts can be created here."
            ),
        )

    existing_username = db.scalar(
        select(User).where(
            User.username == request.username.strip()
        )
    )

    if existing_username is not None:
        raise HTTPException(
            status_code=409,
            detail="Username already exists.",
        )

    existing_email = db.scalar(
        select(User).where(
            User.email == request.email.strip()
        )
    )

    if existing_email is not None:
        raise HTTPException(
            status_code=409,
            detail="Email already exists.",
        )

    role = get_role(
        db,
        actual_role_name,
    )

    user = User(
        username=request.username.strip(),
        email=request.email.strip(),
        password_hash=hash_password(
            request.password
        ),
        full_name=request.full_name.strip(),
        role_id=role.id,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to create staff account because "
                "the username or email already exists."
            ),
        ) from exc

    return {
        "message": (
            f"{actual_role_name} account "
            "created successfully."
        ),
        "staff": serialize_staff(user),
    }


# =========================================================
# PATIENTS
# =========================================================

@router.get("/patients")
def get_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    patients = db.scalars(
        select(Patient)
        .where(
            Patient.is_active.is_(True)
        )
        .order_by(
            Patient.first_name,
            Patient.last_name,
        )
    ).all()

    return {
        "patients": [
            {
                "id": patient.id,
                "patient_id": patient.patient_id,
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "full_name": (
                    f"{patient.first_name} "
                    f"{patient.last_name}"
                ).strip(),
                "is_active": patient.is_active,
            }
            for patient in patients
        ]
    }


# =========================================================
# ASSIGNMENTS
# =========================================================

@router.get("/assignments")
def get_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    rows = db.execute(
        select(
            NursePatientAssignment,
            User,
            Patient,
        )
        .join(
            User,
            User.id
            == NursePatientAssignment.nurse_id,
        )
        .join(
            Patient,
            Patient.id
            == NursePatientAssignment.patient_id,
        )
        .where(
            NursePatientAssignment.is_active.is_(True),
        )
        .order_by(
            desc(
                NursePatientAssignment.assigned_at
            ),
        )
    ).all()

    return {
        "assignments": [
            {
                "id": assignment.id,
                "nurse_id": nurse.id,
                "nurse_name": nurse.full_name,
                "nurse_username": nurse.username,
                "patient_id": patient.id,
                "patient_code": patient.patient_id,
                "patient_name": (
                    f"{patient.first_name} "
                    f"{patient.last_name}"
                ).strip(),
                "assigned_at": assignment.assigned_at,
                "is_active": assignment.is_active,
            }
            for (
                assignment,
                nurse,
                patient,
            ) in rows
        ]
    }


@router.post("/assignments")
def create_assignment(
    request: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    nurse_role = get_role(
        db,
        "Nurse",
    )

    nurse = db.scalar(
        select(User).where(
            User.id == request.nurse_id,
            User.role_id == nurse_role.id,
            User.is_active.is_(True),
        )
    )

    if nurse is None:
        raise HTTPException(
            status_code=404,
            detail="Active nurse not found.",
        )

    patient = db.scalar(
        select(Patient).where(
            Patient.id == request.patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    existing = db.scalar(
        select(
            NursePatientAssignment
        ).where(
            NursePatientAssignment.nurse_id
            == nurse.id,
            NursePatientAssignment.patient_id
            == patient.id,
        )
    )

    if existing is not None:

        if existing.is_active:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This patient is already "
                    "assigned to this nurse."
                ),
            )

        existing.is_active = True
        existing.assigned_at = datetime.utcnow()

        db.commit()
        db.refresh(existing)

        return {
            "message": (
                "Patient assignment "
                "reactivated successfully."
            ),
            "assignment": {
                "id": existing.id,
                "nurse_id": nurse.id,
                "nurse_name": nurse.full_name,
                "patient_id": patient.id,
                "patient_name": (
                    f"{patient.first_name} "
                    f"{patient.last_name}"
                ).strip(),
                "patient_code": patient.patient_id,
                "is_active": existing.is_active,
            },
        }

    assignment = NursePatientAssignment(
        nurse_id=nurse.id,
        patient_id=patient.id,
        assigned_at=datetime.utcnow(),
        is_active=True,
    )

    db.add(assignment)

    try:
        db.commit()
        db.refresh(assignment)

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "This nurse-patient assignment "
                "already exists."
            ),
        ) from exc

    return {
        "message": (
            "Patient assigned to nurse successfully."
        ),
        "assignment": {
            "id": assignment.id,
            "nurse_id": nurse.id,
            "nurse_name": nurse.full_name,
            "patient_id": patient.id,
            "patient_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),
            "patient_code": patient.patient_id,
            "is_active": assignment.is_active,
        },
    }


@router.delete("/assignments/{assignment_id}")
def deactivate_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    require_admin_permission(current_user)

    assignment = db.scalar(
        select(
            NursePatientAssignment
        ).where(
            NursePatientAssignment.id
            == assignment_id,
        )
    )

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found.",
        )

    assignment.is_active = False

    db.commit()

    return {
        "message": (
            "Patient assignment "
            "removed successfully."
        ),
        "assignment_id": assignment_id,
    }


# =========================================================
# DOCTOR-PATIENT ASSIGNMENTS
# =========================================================

@router.get("/doctor-assignments")
def get_doctor_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """
    Return active doctor-patient assignments.

    Doctor assignments are stored on the ACTIVE Encounter
    through Encounter.doctor_id.
    """
    require_admin_permission(current_user)

    rows = db.execute(
        select(
            Encounter,
            User,
            Patient,
        )
        .join(
            User,
            User.id == Encounter.doctor_id,
        )
        .join(
            Patient,
            Patient.id == Encounter.patient_id,
        )
        .where(
            Encounter.doctor_id.is_not(None),
            Encounter.status == "ACTIVE",
            Patient.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(
            desc(Encounter.created_at)
        )
    ).all()

    return {
        "assignments": [
            {
                "id": encounter.id,
                "doctor_id": doctor.id,
                "doctor_name": doctor.full_name,
                "doctor_username": doctor.username,
                "patient_id": patient.id,
                "patient_code": patient.patient_id,
                "patient_name": (
                    f"{patient.first_name} "
                    f"{patient.last_name}"
                ).strip(),
                "encounter_type": encounter.encounter_type,
                "encounter_status": encounter.status,
                "assigned_at": encounter.created_at,
            }
            for (
                encounter,
                doctor,
                patient,
            ) in rows
        ]
    }


@router.post("/doctor-assignments")
def assign_patient_to_doctor(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """
    Assign an active patient to an active doctor.

    The assignment is stored on the patient's ACTIVE
    encounter through Encounter.doctor_id.
    """
    require_admin_permission(current_user)

    doctor_id = request.get("doctor_id")
    patient_id = request.get("patient_id")

    try:
        doctor_id = int(doctor_id)
        patient_id = int(patient_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "doctor_id and patient_id are "
                "required integers."
            ),
        ) from exc

    doctor_role = get_role(
        db,
        "Doctor",
    )

    doctor = db.scalar(
        select(User).where(
            User.id == doctor_id,
            User.role_id == doctor_role.id,
            User.is_active.is_(True),
        )
    )

    if doctor is None:
        raise HTTPException(
            status_code=404,
            detail="Active doctor not found.",
        )

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    now = datetime.utcnow()

    encounter = db.scalar(
        select(Encounter)
        .where(
            Encounter.patient_id == patient.id,
            Encounter.status == "ACTIVE",
        )
        .order_by(
            desc(Encounter.created_at)
        )
    )

    if encounter is None:
        encounter_type = (
            "INPATIENT"
            if patient.bed_id is not None
            else "OPD"
        )

        encounter = Encounter(
            patient_id=patient.id,
            doctor_id=doctor.id,
            encounter_type=encounter_type,
            status="ACTIVE",
            admitted_at=(
                now
                if encounter_type == "INPATIENT"
                else None
            ),
            created_at=now,
            updated_at=now,
        )

        db.add(encounter)

    else:
        encounter.doctor_id = doctor.id
        encounter.updated_at = now

    try:
        db.commit()
        db.refresh(encounter)

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Patient could not be assigned "
                "to the selected doctor."
            ),
        ) from exc

    return {
        "message": (
            "Patient assigned to doctor successfully."
        ),
        "assignment": {
            "id": encounter.id,
            "doctor_id": doctor.id,
            "doctor_name": doctor.full_name,
            "doctor_username": doctor.username,
            "patient_id": patient.id,
            "patient_code": patient.patient_id,
            "patient_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),
            "encounter_type": encounter.encounter_type,
            "encounter_status": encounter.status,
            "assigned_at": encounter.created_at,
        },
    }


@router.delete(
    "/doctor-assignments/{encounter_id}"
)
def remove_patient_from_doctor(
    encounter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """
    Remove the current doctor assignment while preserving
    the encounter as historical clinical data.
    """
    require_admin_permission(current_user)

    encounter = db.scalar(
        select(Encounter).where(
            Encounter.id == encounter_id,
            Encounter.status == "ACTIVE",
        )
    )

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Active doctor assignment not found.",
        )

    encounter.doctor_id = None
    encounter.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": (
            "Patient removed from doctor assignment."
        ),
        "encounter_id": encounter_id,
    }



# =========================================================
# STAFF WORKLOAD
# =========================================================

def serialize_workload_patient(patient: Patient) -> dict:
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "full_name": (
            f"{patient.first_name} {patient.last_name}"
        ).strip(),
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
    }


@router.get("/workload/nurses")
def get_nurse_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """Return all active registered nurses with their active patient workload."""

    require_admin_permission(current_user)

    nurse_role = get_role(db, "Nurse")

    nurses = db.scalars(
        select(User)
        .where(
            User.role_id == nurse_role.id,
            User.is_active.is_(True),
        )
        .order_by(User.full_name, User.username)
    ).all()

    result = []

    for nurse in nurses:
        assignments = db.scalars(
            select(NursePatientAssignment)
            .where(
                NursePatientAssignment.nurse_id == nurse.id,
                NursePatientAssignment.is_active.is_(True),
            )
            .order_by(
                desc(NursePatientAssignment.assigned_at)
            )
        ).all()

        patients = []

        for assignment in assignments:
            patient = db.scalar(
                select(Patient).where(
                    Patient.id == assignment.patient_id,
                    Patient.is_active.is_(True),
                )
            )

            if patient is None:
                continue

            patient_data = serialize_workload_patient(patient)
            patient_data["assignment_id"] = assignment.id
            patient_data["assigned_at"] = assignment.assigned_at
            patients.append(patient_data)

        result.append(
            {
                "id": nurse.id,
                "full_name": nurse.full_name,
                "username": nurse.username,
                "email": nurse.email,
                "role": "Nurse",
                "is_active": nurse.is_active,
                "patient_count": len(patients),
                "patients": patients,
            }
        )

    return {
        "count": len(result),
        "nurses": result,
    }


@router.get("/workload/doctors")
def get_doctor_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """Return all active registered doctors with patients on active encounters."""

    require_admin_permission(current_user)

    doctor_role = get_role(db, "Doctor")

    doctors = db.scalars(
        select(User)
        .where(
            User.role_id == doctor_role.id,
            User.is_active.is_(True),
        )
        .order_by(User.full_name, User.username)
    ).all()

    result = []

    for doctor in doctors:
        encounters = db.scalars(
            select(Encounter)
            .where(
                Encounter.doctor_id == doctor.id,
                Encounter.status == "ACTIVE",
            )
            .order_by(desc(Encounter.created_at))
        ).all()

        patients = []
        seen_patient_ids = set()

        for encounter in encounters:
            if encounter.patient_id in seen_patient_ids:
                continue

            patient = db.scalar(
                select(Patient).where(
                    Patient.id == encounter.patient_id,
                    Patient.is_active.is_(True),
                )
            )

            if patient is None:
                continue

            seen_patient_ids.add(patient.id)

            patient_data = serialize_workload_patient(patient)
            patient_data["encounter_id"] = encounter.id
            patient_data["encounter_type"] = encounter.encounter_type
            patient_data["encounter_status"] = encounter.status
            patient_data["admitted_at"] = encounter.admitted_at
            patient_data["encounter_created_at"] = encounter.created_at
            patients.append(patient_data)

        result.append(
            {
                "id": doctor.id,
                "full_name": doctor.full_name,
                "username": doctor.username,
                "email": doctor.email,
                "role": "Doctor",
                "is_active": doctor.is_active,
                "patient_count": len(patients),
                "patients": patients,
            }
        )

    return {
        "count": len(result),
        "doctors": result,
    }


# =========================================================
# PATIENT LIFECYCLE MANAGEMENT
# =========================================================

def serialize_billing(
    billing: PatientBilling | None,
):
    if billing is None:
        return {
            "bill_status": "PENDING",
            "bill_amount": None,
            "paid_at": None,
            "paid_by": None,
        }

    return {
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


def serialize_encounter(
    encounter: Encounter,
):
    return {
        "id": encounter.id,
        "patient_id": encounter.patient_id,
        "doctor_id": encounter.doctor_id,
        "doctor_name": (
            encounter.doctor.full_name
            if encounter.doctor is not None
            else None
        ),
        "encounter_type": encounter.encounter_type,
        "status": encounter.status,
        "admitted_at": encounter.admitted_at,
        "discharged_at": encounter.discharged_at,
        "discharge_reason": encounter.discharge_reason,
        "discharged_by": encounter.discharged_by,
        "created_at": encounter.created_at,
        "updated_at": encounter.updated_at,
    }


@router.get("/patients/lifecycle")
def get_patient_lifecycle(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    active_patients = db.scalars(
        select(Patient)
        .where(
            Patient.is_active.is_(True)
        )
        .order_by(
            Patient.first_name,
            Patient.last_name,
        )
    ).all()

    discharged_patients = db.scalars(
        select(Patient)
        .where(
            Patient.is_active.is_(False)
        )
        .order_by(
            desc(Patient.updated_at)
        )
    ).all()

    def patient_summary(
        patient: Patient,
    ):
        billing = db.scalar(
            select(PatientBilling).where(
                PatientBilling.patient_id
                == patient.id
            )
        )

        active_encounter = db.scalar(
            select(Encounter)
            .where(
                Encounter.patient_id
                == patient.id,
                Encounter.status == "ACTIVE",
            )
            .order_by(
                desc(Encounter.created_at)
            )
        )

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
            "billing": serialize_billing(
                billing
            ),
            "active_encounter": (
                serialize_encounter(
                    active_encounter
                )
                if active_encounter
                else None
            ),
        }

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


@router.post(
    "/patients/{patient_id}/billing"
)
def create_or_update_patient_bill(
    patient_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
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

    amount = request.get("bill_amount")

    if amount in (None, ""):
        bill_amount = None
    else:
        try:
            bill_amount = float(amount)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=(
                    "bill_amount must be "
                    "a valid number."
                ),
            )

        if bill_amount < 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "bill_amount cannot be negative."
                ),
            )

    billing = db.scalar(
        select(PatientBilling).where(
            PatientBilling.patient_id
            == patient.id
        )
    )

    if billing is None:

        billing = PatientBilling(
            patient_id=patient.id,
            bill_status="PENDING",
            bill_amount=bill_amount,
        )

        db.add(billing)

    else:

        if billing.bill_status == "PAID":
            raise HTTPException(
                status_code=409,
                detail=(
                    "The patient's bill is "
                    "already marked as paid."
                ),
            )

        billing.bill_amount = bill_amount
        billing.bill_status = "PENDING"

    db.commit()
    db.refresh(billing)

    return {
        "message": (
            "Patient bill updated successfully."
        ),
        "billing": serialize_billing(
            billing
        ),
    }


@router.post(
    "/patients/{patient_id}/billing/paid"
)
def mark_patient_bill_paid(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
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

    if not patient.is_active:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot update billing for "
                "a discharged patient."
            ),
        )

    billing = db.scalar(
        select(PatientBilling).where(
            PatientBilling.patient_id
            == patient.id
        )
    )

    if billing is None:

        billing = PatientBilling(
            patient_id=patient.id,
            bill_status="PAID",
            paid_at=datetime.utcnow(),
            paid_by=current_user.id,
        )

        db.add(billing)

    else:

        if billing.bill_status == "PAID":
            return {
                "message": (
                    "Patient bill is already "
                    "marked as paid."
                ),
                "billing": serialize_billing(
                    billing
                ),
            }

        billing.bill_status = "PAID"
        billing.paid_at = datetime.utcnow()
        billing.paid_by = current_user.id

    db.commit()
    db.refresh(billing)

    return {
        "message": (
            "Patient bill marked as paid."
        ),
        "billing": serialize_billing(
            billing
        ),
    }


@router.post(
    "/patients/{patient_id}/discharge"
)
def discharge_patient(
    patient_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
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

    if not patient.is_active:
        raise HTTPException(
            status_code=409,
            detail="Patient is already discharged.",
        )

    billing = db.scalar(
        select(PatientBilling).where(
            PatientBilling.patient_id
            == patient.id
        )
    )

    if (
        billing is None
        or billing.bill_status != "PAID"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Patient cannot be discharged "
                "until the bill is marked as paid."
            ),
        )

    discharge_reason = request.get(
        "discharge_reason"
    )

    if discharge_reason is not None:
        discharge_reason = str(
            discharge_reason
        ).strip() or None

    now = datetime.utcnow()

    # -----------------------------------------------------
    # Close active encounters
    # -----------------------------------------------------

    encounters = db.scalars(
        select(Encounter).where(
            Encounter.patient_id == patient.id,
            Encounter.status == "ACTIVE",
        )
    ).all()

    for encounter in encounters:
        encounter.status = "DISCHARGED"
        encounter.discharged_at = now
        encounter.discharge_reason = (
            discharge_reason
        )
        encounter.discharged_by = (
            current_user.id
        )

    # -----------------------------------------------------
    # Close nurse assignments
    # -----------------------------------------------------

    assignments = db.scalars(
        select(NursePatientAssignment).where(
            NursePatientAssignment.patient_id
            == patient.id,
            NursePatientAssignment.is_active.is_(
                True
            ),
        )
    ).all()

    for assignment in assignments:
        assignment.is_active = False

    # -----------------------------------------------------
    # Release bed
    # -----------------------------------------------------

    released_bed_id = patient.bed_id

    if patient.bed_id is not None:

        bed = db.scalar(
            select(Bed).where(
                Bed.id == patient.bed_id
            )
        )

        if bed is not None:
            bed.is_occupied = False
            bed.updated_at = now

    # -----------------------------------------------------
    # Deactivate patient + QR
    # -----------------------------------------------------

    patient.is_active = False
    patient.qr_is_active = False
    patient.updated_at = now

    db.commit()
    db.refresh(patient)

    return {
        "message": (
            "Patient discharged successfully."
        ),
        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,
            "full_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),
            "is_active": patient.is_active,
            "qr_is_active": patient.qr_is_active,
        },
        "discharge": {
            "discharged_at": now,
            "discharged_by": current_user.id,
            "discharge_reason": (
                discharge_reason
            ),
        },
        "released_bed_id": released_bed_id,
        "closed_assignments": len(
            assignments
        ),
        "closed_encounters": len(
            encounters
        ),
    }


@router.get(
    "/patients/{patient_id}/history"
)
def get_patient_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
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

    billing = db.scalar(
        select(PatientBilling).where(
            PatientBilling.patient_id
            == patient.id
        )
    )

    encounters = db.scalars(
        select(Encounter)
        .where(
            Encounter.patient_id == patient.id
        )
        .order_by(
            desc(Encounter.created_at)
        )
    ).all()

    assignments = db.scalars(
        select(NursePatientAssignment)
        .where(
            NursePatientAssignment.patient_id
            == patient.id
        )
        .order_by(
            desc(
                NursePatientAssignment.assigned_at
            )
        )
    ).all()

    assignment_history = []

    for assignment in assignments:

        nurse = db.scalar(
            select(User).where(
                User.id == assignment.nurse_id
            )
        )

        assignment_history.append(
            {
                "id": assignment.id,
                "nurse_id": assignment.nurse_id,
                "nurse_name": (
                    nurse.full_name
                    if nurse is not None
                    else None
                ),
                "assigned_at": (
                    assignment.assigned_at
                ),
                "is_active": (
                    assignment.is_active
                ),
            }
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
            "is_active": patient.is_active,
            "ward_id": patient.ward_id,
            "bed_id": patient.bed_id,
            "qr_is_active": patient.qr_is_active,
        },
        "billing": serialize_billing(
            billing
        ),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Fetch all active wards with bed statistics.
    """

    wards = db.scalars(
        select(Ward)
        .where(
            Ward.is_active.is_(True)
        )
        .order_by(
            Ward.id
        )
    ).all()

    result = []

    for ward in wards:

        total_beds = db.scalar(
            select(
                func.count(Bed.id)
            ).where(
                Bed.ward_id == ward.id,
                Bed.is_active.is_(True),
            )
        ) or 0

        occupied_beds = db.scalar(
            select(
                func.count(Bed.id)
            ).where(
                Bed.ward_id == ward.id,
                Bed.is_active.is_(True),
                Bed.is_occupied.is_(True),
            )
        ) or 0

        available_beds = (
            int(total_beds)
            - int(occupied_beds)
        )

        result.append(
            {
                "id": ward.id,
                "name": ward.name,
                "code": ward.code,
                "description": ward.description,
                "total_beds": int(
                    total_beds
                ),
                "occupied_beds": int(
                    occupied_beds
                ),
                "available_beds": int(
                    available_beds
                ),
            }
        )

    return {
        "count": len(result),
        "wards": result,
    }


@router.post("/wards")
def create_ward(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Create a new ward.
    """

    name = str(
        request.get("name", "")
    ).strip()

    code = str(
        request.get("code", "")
    ).strip()

    description = request.get(
        "description"
    )

    if description is not None:
        description = (
            str(description).strip()
            or None
        )

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

    existing_name = db.scalar(
        select(Ward).where(
            Ward.name == name
        )
    )

    if existing_name is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "A ward with this name "
                "already exists."
            ),
        )

    existing_code = db.scalar(
        select(Ward).where(
            Ward.code == code
        )
    )

    if existing_code is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "A ward with this code "
                "already exists."
            ),
        )

    now = datetime.utcnow()

    ward = Ward(
        name=name,
        code=code,
        description=description,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    try:

        db.add(ward)
        db.commit()
        db.refresh(ward)

    except IntegrityError as exc:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to create ward because "
                "the name or code already exists."
            ),
        ) from exc

    return {
        "message": "Ward created successfully.",
        "ward": {
            "id": ward.id,
            "name": ward.name,
            "code": ward.code,
            "description": ward.description,
            "is_active": ward.is_active,
            "total_beds": 0,
            "occupied_beds": 0,
            "available_beds": 0,
        },
    }


# =========================================================
# BED MANAGEMENT
# =========================================================

@router.get(
    "/wards/{ward_id}/beds"
)
def get_ward_beds(
    ward_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Fetch all active beds belonging to a ward.

    Occupied beds include the active
    patient's name and Patient ID.
    """

    ward = db.scalar(
        select(Ward).where(
            Ward.id == ward_id,
            Ward.is_active.is_(True),
        )
    )

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found.",
        )

    beds = db.scalars(
        select(Bed)
        .where(
            Bed.ward_id == ward.id,
            Bed.is_active.is_(True),
        )
        .order_by(
            Bed.bed_number
        )
    ).all()

    result = []

    for bed in beds:

        patient = db.scalar(
            select(Patient).where(
                Patient.bed_id == bed.id,
                Patient.is_active.is_(True),
            )
        )

        result.append(
            {
                "id": bed.id,
                "bed_number": bed.bed_number,
                "ward_id": bed.ward_id,
                "is_active": bed.is_active,
                "is_occupied": bed.is_occupied,
                "status": (
                    "OCCUPIED"
                    if bed.is_occupied
                    else "AVAILABLE"
                ),
                "patient": (
                    {
                        "id": patient.id,
                        "patient_id": (
                            patient.patient_id
                        ),
                        "full_name": (
                            f"{patient.first_name} "
                            f"{patient.last_name}"
                        ).strip(),
                    }
                    if patient is not None
                    else None
                ),
            }
        )

    occupied = sum(
        1
        for bed in result
        if bed["is_occupied"]
    )

    return {
        "ward": {
            "id": ward.id,
            "name": ward.name,
            "code": ward.code,
            "description": (
                ward.description
            ),
        },
        "counts": {
            "total": len(result),
            "occupied": occupied,
            "available": (
                len(result) - occupied
            ),
        },
        "beds": result,
    }


@router.post(
    "/wards/{ward_id}/beds"
)
def create_bed(
    ward_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Add a bed to an existing ward.
    """

    ward = db.scalar(
        select(Ward).where(
            Ward.id == ward_id,
            Ward.is_active.is_(True),
        )
    )

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found.",
        )

    bed_number = str(
        request.get("bed_number", "")
    ).strip()

    if not bed_number:
        raise HTTPException(
            status_code=400,
            detail="Bed number is required.",
        )

    existing_bed = db.scalar(
        select(Bed).where(
            Bed.ward_id == ward.id,
            Bed.bed_number == bed_number,
        )
    )

    if existing_bed is not None:

        if existing_bed.is_active:
            raise HTTPException(
                status_code=409,
                detail=(
                    "A bed with this number "
                    "already exists in this ward."
                ),
            )

        existing_bed.is_active = True
        existing_bed.is_occupied = False
        existing_bed.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(existing_bed)

        return {
            "message": (
                "Bed reactivated successfully."
            ),
            "bed": {
                "id": existing_bed.id,
                "ward_id": (
                    existing_bed.ward_id
                ),
                "bed_number": (
                    existing_bed.bed_number
                ),
                "is_active": (
                    existing_bed.is_active
                ),
                "is_occupied": (
                    existing_bed.is_occupied
                ),
                "status": "AVAILABLE",
            },
        }

    now = datetime.utcnow()

    bed = Bed(
        ward_id=ward.id,
        bed_number=bed_number,
        is_active=True,
        is_occupied=False,
        created_at=now,
        updated_at=now,
    )

    try:

        db.add(bed)
        db.commit()
        db.refresh(bed)

    except IntegrityError as exc:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Unable to create bed.",
        ) from exc

    return {
        "message": "Bed created successfully.",
        "bed": {
            "id": bed.id,
            "ward_id": bed.ward_id,
            "bed_number": bed.bed_number,
            "is_active": bed.is_active,
            "is_occupied": bed.is_occupied,
            "status": "AVAILABLE",
        },
    }


@router.delete(
    "/wards/{ward_id}/beds/{bed_id}"
)
def deactivate_bed(
    ward_id: int,
    bed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Deactivate an available bed.
    """

    bed = db.scalar(
        select(Bed).where(
            Bed.id == bed_id,
            Bed.ward_id == ward_id,
        )
    )

    if bed is None:
        raise HTTPException(
            status_code=404,
            detail="Bed not found.",
        )

    if bed.is_occupied:
        raise HTTPException(
            status_code=409,
            detail=(
                "Occupied beds cannot be deactivated. "
                "Discharge or move the patient first."
            ),
        )

    bed.is_active = False
    bed.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": (
            "Bed deactivated successfully."
        ),
        "bed_id": bed.id,
    }


# =========================================================
# PATIENT BED ASSIGNMENT
# =========================================================

@router.post(
    "/patients/{patient_id}/assign-bed"
)
def assign_patient_bed(
    patient_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Assign an active patient to an available bed.

    Updates:
    - Patient ward
    - Patient bed
    - Bed occupied state
    - Active encounter
    """

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    ward_id = request.get("ward_id")
    bed_id = request.get("bed_id")

    try:
        ward_id = int(ward_id)
        bed_id = int(bed_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=(
                "ward_id and bed_id are "
                "required integers."
            ),
        )

    ward = db.scalar(
        select(Ward).where(
            Ward.id == ward_id,
            Ward.is_active.is_(True),
        )
    )

    if ward is None:
        raise HTTPException(
            status_code=404,
            detail="Ward not found or inactive.",
        )

    bed = db.scalar(
        select(Bed).where(
            Bed.id == bed_id,
            Bed.ward_id == ward.id,
            Bed.is_active.is_(True),
        )
    )

    if bed is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Bed not found, inactive, or "
                "not part of the selected ward."
            ),
        )

    if bed.is_occupied:

        existing_patient = db.scalar(
            select(Patient).where(
                Patient.bed_id == bed.id,
                Patient.is_active.is_(True),
            )
        )

        if (
            existing_patient is not None
            and existing_patient.id
            != patient.id
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This bed is already assigned "
                    "to another active patient."
                ),
            )

    now = datetime.utcnow()

    previous_bed_id = patient.bed_id

    if (
        previous_bed_id is not None
        and previous_bed_id != bed.id
    ):

        previous_bed = db.scalar(
            select(Bed).where(
                Bed.id == previous_bed_id
            )
        )

        if previous_bed is not None:
            previous_bed.is_occupied = False
            previous_bed.updated_at = now

    patient.ward_id = ward.id
    patient.bed_id = bed.id
    patient.is_active = True
    patient.updated_at = now

    bed.is_occupied = True
    bed.updated_at = now

    encounter = db.scalar(
        select(Encounter)
        .where(
            Encounter.patient_id == patient.id,
            Encounter.status == "ACTIVE",
        )
        .order_by(
            desc(
                Encounter.created_at
            )
        )
    )

    if encounter is None:

        encounter = Encounter(
            patient_id=patient.id,
            encounter_type="INPATIENT",
            status="ACTIVE",
            admitted_at=now,
            created_at=now,
            updated_at=now,
        )

        db.add(encounter)

    else:

        encounter.encounter_type = "INPATIENT"

        if encounter.admitted_at is None:
            encounter.admitted_at = now

        encounter.updated_at = now

    try:

        db.commit()

        db.refresh(patient)
        db.refresh(bed)
        db.refresh(encounter)

    except IntegrityError as exc:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Bed assignment "
                "could not be completed."
            ),
        ) from exc

    return {
        "message": (
            "Patient assigned to "
            "bed successfully."
        ),
        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,
            "full_name": (
                f"{patient.first_name} "
                f"{patient.last_name}"
            ).strip(),
            "ward_id": patient.ward_id,
            "bed_id": patient.bed_id,
            "is_active": patient.is_active,
        },
        "ward": {
            "id": ward.id,
            "name": ward.name,
            "code": ward.code,
        },
        "bed": {
            "id": bed.id,
            "bed_number": bed.bed_number,
            "is_occupied": bed.is_occupied,
        },
        "encounter": {
            "id": encounter.id,
            "encounter_type": (
                encounter.encounter_type
            ),
            "status": encounter.status,
            "admitted_at": encounter.admitted_at,
        },
        "previous_bed_id": previous_bed_id,
    }


@router.post(
    "/patients/{patient_id}/release-bed"
)
def release_patient_bed(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_SYSTEM")
    ),
):
    """
    Release an active patient's bed.
    """

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Active patient not found.",
        )

    if patient.bed_id is None:
        return {
            "message": (
                "Patient has no assigned bed."
            ),
            "patient_id": patient.id,
            "bed_id": None,
        }

    bed = db.scalar(
        select(Bed).where(
            Bed.id == patient.bed_id
        )
    )

    previous_bed_id = patient.bed_id

    if bed is not None:
        bed.is_occupied = False
        bed.updated_at = datetime.utcnow()

    patient.bed_id = None
    patient.ward_id = None
    patient.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": (
            "Patient bed released successfully."
        ),
        "patient_id": patient.id,
        "released_bed_id": previous_bed_id,
    }