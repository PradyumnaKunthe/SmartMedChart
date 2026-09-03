from sqlalchemy import select

from app.database import SessionLocal
from app.models import MedicationSchedule

from ai.feature_service import build_medication_features
from ai.prediction_service import predict_medication_risk


db = SessionLocal()

try:
    schedule_id = 2

    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == schedule_id
        )
    )

    if schedule is None:
        raise RuntimeError(
            f"Medication schedule {schedule_id} was not found."
        )

    # ---------------------------------------------
    # Build AI features from the real database
    # ---------------------------------------------

    features = build_medication_features(
        db=db,
        schedule_id=schedule_id,
    )

    # ---------------------------------------------
    # Run the trained AI models
    # ---------------------------------------------

    result = predict_medication_risk(
        features
    )

    print("=" * 60)
    print("SMARTMEDCHART REAL-DATABASE AI TEST")
    print("=" * 60)

    print("\nSchedule ID:")
    print(schedule_id)

    print("\nFeatures used by AI:")
    for key, value in features.items():
        print(f"{key}: {value}")

    print("\nAI prediction:")
    for key, value in result.items():
        print(f"{key}: {value}")

finally:
    db.close()