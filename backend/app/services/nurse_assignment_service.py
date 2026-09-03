from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import NursePatientAssignment


def get_assigned_patient_ids(
    db: Session,
    nurse_id: int,
) -> set[int]:
    rows = db.scalars(
        select(NursePatientAssignment.patient_id).where(
            NursePatientAssignment.nurse_id == nurse_id,
            NursePatientAssignment.is_active.is_(True),
        )
    ).all()

    return set(rows)


def is_patient_assigned(
    db: Session,
    nurse_id: int,
    patient_id: int,
) -> bool:
    assignment = db.scalar(
        select(NursePatientAssignment).where(
            NursePatientAssignment.nurse_id == nurse_id,
            NursePatientAssignment.patient_id == patient_id,
            NursePatientAssignment.is_active.is_(True),
        )
    )

    return assignment is not None