from datetime import datetime

from app.mongo_client import mongo_db, next_mongo_id


VALID_ADMINISTRATION_STATUSES = {
    "GIVEN",
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
}


def record_medication_administration(
    medication_schedule_id: int,
    administered_by: int,
    status: str,
    notes: str | None = None,
    administered_at: datetime | None = None,
    db=None,
) -> dict:
    """
    Record the result of a medication administration attempt using MongoDB.
    """

    status = status.upper().strip()

    if status not in VALID_ADMINISTRATION_STATUSES:
        raise ValueError(
            f"Invalid administration status: {status}. "
            f"Allowed values: {', '.join(sorted(VALID_ADMINISTRATION_STATUSES))}"
        )

    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": medication_schedule_id},
            {"id": medication_schedule_id},
        ]
    })

    if schedule is None:
        raise ValueError(
            f"Medication schedule {medication_schedule_id} was not found."
        )

    actual_schedule_id = schedule.get("id", schedule.get("_id"))

    # Prevent the same scheduled dose from being recorded multiple times.
    existing = mongo_db.medication_administrations.find_one({
        "medication_schedule_id": actual_schedule_id
    })

    if existing is not None:
        raise ValueError(
            f"Medication schedule {medication_schedule_id} "
            "already has an administration record."
        )

    if administered_at is None:
        administered_at = datetime.utcnow()

    administered_at_str = (
        administered_at.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(administered_at, datetime)
        else str(administered_at)
    )

    new_id = next_mongo_id("medication_administrations")
    administration = {
        "_id": new_id,
        "id": new_id,
        "medication_schedule_id": actual_schedule_id,
        "administered_by": administered_by,
        "status": status,
        "administered_at": administered_at_str,
        "notes": notes,
        "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    }

    mongo_db.medication_administrations.insert_one(administration)

    # Keep the schedule synchronized with the actual result.
    mongo_db.medication_schedules.update_one(
        {"$or": [{"_id": actual_schedule_id}, {"id": actual_schedule_id}]},
        {
            "$set": {
                "status": status,
                "actual_administration_time": administered_at_str,
                "administered_by": administered_by,
                "updated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            }
        },
    )

    return administration