from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    NursePatientAssignment,
    Patient,
    Role,
    User,
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
    else:
        raise HTTPException(
            status_code=400,
            detail="Only Nurse and Doctor accounts can be created here.",
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
            detail="Unable to create staff account because the username or email already exists.",
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
                detail="This patient is already assigned to this nurse.",
            )

        existing.is_active = True
        existing.assigned_at = datetime.utcnow()

        db.commit()
        db.refresh(existing)

        return {
            "message": "Patient assignment reactivated successfully.",
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
            detail="This nurse-patient assignment already exists.",
        ) from exc

    return {
        "message": "Patient assigned to nurse successfully.",
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
        "message": "Patient assignment removed successfully.",
        "assignment_id": assignment_id,
    }