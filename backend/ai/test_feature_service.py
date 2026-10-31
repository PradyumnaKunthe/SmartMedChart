from app.mongo_client import mongo_db
from ai.feature_service import build_medication_features


schedule = mongo_db.medication_schedules.find_one({"$or": [{"_id": 2}, {"id": 2}]})
if schedule is None:
    schedule = mongo_db.medication_schedules.find_one()

if schedule is None:
    raise RuntimeError("No medication schedule found in MongoDB.")

sched_id = schedule.get("id", schedule.get("_id"))
features = build_medication_features(schedule_id=sched_id)

print("=" * 60)
print("SMARTMEDCHART AI FEATURE EXTRACTION (MONGODB)")
print("=" * 60)

print("\nSchedule ID:", sched_id)

print("\nAI features:")
for key, value in features.items():
    print(f"{key}: {value}")