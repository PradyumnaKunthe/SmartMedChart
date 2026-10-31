from app.mongo_client import mongo_db
from ai.feature_service import build_medication_features
from ai.prediction_service import predict_medication_risk


schedule = mongo_db.medication_schedules.find_one({"$or": [{"_id": 1}, {"id": 1}]})
if schedule is None:
    schedule = mongo_db.medication_schedules.find_one()

if schedule is None:
    raise RuntimeError("No medication schedule found in MongoDB.")

schedule_id = schedule.get("id", schedule.get("_id"))

# Build AI features from MongoDB
features = build_medication_features(schedule_id=schedule_id)

# Run the trained AI models
result = predict_medication_risk(features)

print("=" * 60)
print("SMARTMEDCHART REAL-DATABASE AI TEST (MONGODB)")
print("=" * 60)

print("\nSchedule ID:")
print(schedule_id)

print("\nFeatures used by AI:")
for key, value in features.items():
    print(f"{key}: {value}")

print("\nAI prediction:")
for key, value in result.items():
    print(f"{key}: {value}")