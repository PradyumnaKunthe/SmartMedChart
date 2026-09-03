from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models.medication_schedule import MedicationSchedule
from app.models.prescription_item import PrescriptionItem


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


def combine_date_time(schedule_date: date, schedule_time: time) -> datetime:
    """Combine a date and time into one datetime."""
    return datetime.combine(schedule_date, schedule_time)


def generate_schedule_times(
    start_date: date,
    start_time: time,
    duration_days: int,
    frequency: str,
) -> list[datetime]:
    """
    Generate all scheduled medication times.

    Supported frequencies:
    ONCE
    ONCE_DAILY
    TWICE_DAILY
    THREE_TIMES_DAILY
    FOUR_TIMES_DAILY
    EVERY_4_HOURS
    EVERY_6_HOURS
    EVERY_8_HOURS
    EVERY_12_HOURS
    STAT
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
    db: Session,
    prescription_item: PrescriptionItem,
) -> list[MedicationSchedule]:
    """
    Generate and save medication schedule records
    for a prescription item.
    """

    schedule_times = generate_schedule_times(
        start_date=prescription_item.start_date,
        start_time=prescription_item.start_time,
        duration_days=prescription_item.duration_days,
        frequency=prescription_item.frequency,
    )

    schedule_records: list[MedicationSchedule] = []

    for scheduled_datetime in schedule_times:
        schedule_record = MedicationSchedule(
            prescription_item_id=prescription_item.id,
            scheduled_date=scheduled_datetime.date(),
            scheduled_time=scheduled_datetime.time(),
            status="UPCOMING",
        )

        db.add(schedule_record)
        schedule_records.append(schedule_record)

    db.commit()

    return schedule_records