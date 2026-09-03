from sqlalchemy import select

from app.database import SessionLocal
from app.models import MedicationSchedule, Prescription, PrescriptionItem


db = SessionLocal()

try:
    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id == 6
        )
    )

    if prescription is None:
        raise RuntimeError("Prescription 6 was not found.")

    item = db.scalar(
        select(PrescriptionItem).where(
            PrescriptionItem.prescription_id == 6
        )
    )

    if item is None:
        raise RuntimeError(
            "Prescription item for Prescription 6 was not found."
        )

    # Make sure both remain stopped for this test.
    prescription.status = "STOPPED"
    item.status = "STOPPED"

    # Create a temporary schedule for testing.
    schedule = MedicationSchedule(
        prescription_item_id=item.id,
        scheduled_date=prescription.created_at.date(),
        scheduled_time=prescription.created_at.time().replace(
            microsecond=0
        ),
        status="UPCOMING",
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    print("Stopped prescription test schedule created.")
    print("Schedule ID:", schedule.id)
    print("Prescription ID:", prescription.id)
    print("Prescription status:", prescription.status)
    print("Prescription item status:", item.status)

finally:
    db.close()