from sqlalchemy import select

from app.database import SessionLocal
from app.models import MedicationAdministration, MedicationSchedule


db = SessionLocal()

try:
    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == 1
        )
    )

    print("=== MEDICATION SCHEDULE 1 ===")

    if schedule is None:
        print("Schedule 1 does not exist.")
    else:
        print("ID:", schedule.id)
        print("Status:", schedule.status)
        print(
            "Actual administration time:",
            schedule.actual_administration_time,
        )
        print(
            "Administered by:",
            schedule.administered_by,
        )

    administrations = db.scalars(
        select(MedicationAdministration).where(
            MedicationAdministration.medication_schedule_id == 1
        )
    ).all()

    print("\n=== ADMINISTRATION RECORDS ===")
    print("Count:", len(administrations))

    for administration in administrations:
        print("Administration ID:", administration.id)
        print("Status:", administration.status)
        print("Administered by:", administration.administered_by)
        print("Administered at:", administration.administered_at)
        print("Notes:", administration.notes)

finally:
    db.close()