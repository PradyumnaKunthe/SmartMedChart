from sqlalchemy import select

from app.database import SessionLocal
from app.models import MedicationSchedule


db = SessionLocal()

try:
    schedules = db.scalars(
        select(MedicationSchedule)
        .where(
            MedicationSchedule.prescription_item_id == 6
        )
        .order_by(
            MedicationSchedule.scheduled_date,
            MedicationSchedule.scheduled_time,
        )
    ).all()

    print(f"Schedules found: {len(schedules)}")

    for schedule in schedules:
        print(
            schedule.id,
            schedule.scheduled_date,
            schedule.scheduled_time,
            schedule.status,
        )

finally:
    db.close()