from sqlalchemy import select

from app.database import SessionLocal
from app.models import MedicationSchedule
from ai.feature_service import build_medication_features


db = SessionLocal()

try:
    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == 2
        )
    )

    if schedule is None:
        raise RuntimeError(
            "Medication schedule 2 was not found."
        )

    features = build_medication_features(
        db=db,
        schedule_id=2,
    )

    print("=" * 60)
    print("SMARTMEDCHART AI FEATURE EXTRACTION")
    print("=" * 60)

    print("\nSchedule ID:", schedule.id)

    print("\nAI features:")

    for key, value in features.items():
        print(f"{key}: {value}")

finally:
    db.close()