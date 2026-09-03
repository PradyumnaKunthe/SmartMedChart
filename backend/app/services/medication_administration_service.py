from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.medication_administration import MedicationAdministration
from app.models.medication_schedule import MedicationSchedule


VALID_ADMINISTRATION_STATUSES = {
    "GIVEN",
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
}


def record_medication_administration(
    db: Session,
    medication_schedule_id: int,
    administered_by: int,
    status: str,
    notes: str | None = None,
    administered_at: datetime | None = None,
) -> MedicationAdministration:
    """
    Record the result of a medication administration attempt.

    The schedule is the planned medication event.
    The administration record stores what actually happened.
    """

    status = status.upper().strip()

    if status not in VALID_ADMINISTRATION_STATUSES:
        raise ValueError(
            f"Invalid administration status: {status}. "
            f"Allowed values: {', '.join(sorted(VALID_ADMINISTRATION_STATUSES))}"
        )

    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == medication_schedule_id
        )
    )

    if schedule is None:
        raise ValueError(
            f"Medication schedule {medication_schedule_id} was not found."
        )

    # Prevent the same scheduled dose from being recorded multiple times.
    existing = db.scalar(
        select(MedicationAdministration).where(
            MedicationAdministration.medication_schedule_id
            == medication_schedule_id
        )
    )

    if existing is not None:
        raise ValueError(
            f"Medication schedule {medication_schedule_id} "
            "already has an administration record."
        )

    if administered_at is None:
        administered_at = datetime.utcnow()

    administration = MedicationAdministration(
        medication_schedule_id=medication_schedule_id,
        administered_by=administered_by,
        status=status,
        administered_at=administered_at,
        notes=notes,
    )

    db.add(administration)

    # Keep the schedule synchronized with the actual result.
    schedule.status = status
    schedule.actual_administration_time = administered_at
    schedule.administered_by = administered_by

    db.commit()
    db.refresh(administration)

    return administration