from datetime import date, datetime, time, timedelta

from app.mongo_client import mongo_db, next_mongo_id


# Frequency definitions.
# Each value represents the time gap in hours or a special schedule.
FREQUENCY_HOURS = {
    "TWICE_DAILY": 12,
    "THREE_TIMES_DAILY": 8,
    "FOUR_TIMES_DAILY": 6,
    "EVERY_4_HOURS": 4,
    "EVERY_6_HOURS": 6,
    "EVERY_8_HOURS": 8,
    "EVERY_12_HOURS": 12,
}


def combine_date_time(schedule_date, schedule_time) -> datetime:
    """Combine a date and time into one datetime."""
    if isinstance(schedule_date, str):
        schedule_date = datetime.strptime(schedule_date[:10], "%Y-%m-%d").date()
    if isinstance(schedule_time, str):
        t_part = schedule_time.split(".")[0].strip()
        schedule_time = datetime.strptime(t_part, "%H:%M:%S").time()
    return datetime.combine(schedule_date, schedule_time)


def generate_schedule_times(
    start_date,
    start_time,
    duration_days: int,
    frequency: str,
) -> list[datetime]:
    """
    Generate all scheduled medication times.
    """

    if duration_days <= 0:
        raise ValueError("duration_days must be greater than zero.")

    frequency = frequency.upper().strip()

    first_datetime = combine_date_time(start_date, start_time)

    # STAT means one immediate medication task.
    if frequency == "STAT":
        return [first_datetime]

    # ONCE means one medication task.
    if frequency == "ONCE":
        return [first_datetime]

    # ONCE_DAILY means one dose at the same time each day.
    if frequency == "ONCE_DAILY":
        return [
            first_datetime + timedelta(days=day)
            for day in range(duration_days)
        ]

    if frequency not in FREQUENCY_HOURS:
        raise ValueError(
            f"Unsupported medication frequency: {frequency}"
        )

    interval = timedelta(hours=FREQUENCY_HOURS[frequency])
    end_datetime = first_datetime + timedelta(days=duration_days)
    schedule_times: list[datetime] = []
    current_datetime = first_datetime

    while current_datetime < end_datetime:
        schedule_times.append(current_datetime)
        current_datetime += interval

    return schedule_times


def create_medication_schedule(
    prescription_item,
    db=None,
) -> list[dict]:
    """
    Generate and save medication schedule records in MongoDB.
    Accepts either a dict or an object.
    """

    if isinstance(prescription_item, dict):
        item_id = prescription_item.get("id", prescription_item.get("_id"))
        start_date = prescription_item.get("start_date")
        start_time = prescription_item.get("start_time")
        duration_days = prescription_item.get("duration_days", 1)
        frequency = prescription_item.get("frequency", "ONCE_DAILY")
    else:
        item_id = getattr(prescription_item, "id", None)
        start_date = getattr(prescription_item, "start_date", None)
        start_time = getattr(prescription_item, "start_time", None)
        duration_days = getattr(prescription_item, "duration_days", 1)
        frequency = getattr(prescription_item, "frequency", "ONCE_DAILY")

    schedule_times = generate_schedule_times(
        start_date=start_date,
        start_time=start_time,
        duration_days=duration_days,
        frequency=frequency,
    )

    schedule_records: list[dict] = []

    for scheduled_datetime in schedule_times:
        new_id = next_mongo_id("medication_schedules")
        record = {
            "_id": new_id,
            "id": new_id,
            "prescription_item_id": item_id,
            "scheduled_date": scheduled_datetime.date().isoformat(),
            "scheduled_time": scheduled_datetime.time().isoformat(),
            "status": "UPCOMING",
            "actual_administration_time": None,
            "administered_by": None,
            "notes": None,
            "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        }
        mongo_db.medication_schedules.insert_one(record)
        schedule_records.append(record)

    return schedule_records