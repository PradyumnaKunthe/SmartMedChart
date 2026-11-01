from datetime import date, datetime, time, timedelta
from typing import Any, List, Optional

from app.mongo_client import mongo_db, next_mongo_id


# Standard frequency definitions with time gaps and required counts
FREQUENCY_HOURS = {
    "TWICE_DAILY": 12,
    "THREE_TIMES_DAILY": 8,
    "FOUR_TIMES_DAILY": 6,
    "EVERY_4_HOURS": 4,
    "EVERY_6_HOURS": 6,
    "EVERY_8_HOURS": 8,
    "EVERY_12_HOURS": 12,
}

FREQUENCY_DAILY_COUNTS = {
    "ONCE_DAILY": 1,
    "QD": 1,
    "TWICE_DAILY": 2,
    "BID": 2,
    "THREE_TIMES_DAILY": 3,
    "TID": 3,
    "FOUR_TIMES_DAILY": 4,
    "QID": 4,
    "EVERY_4_HOURS": 6,
    "Q4H": 6,
    "EVERY_6_HOURS": 4,
    "Q6H": 4,
    "EVERY_8_HOURS": 3,
    "Q8H": 3,
    "EVERY_12_HOURS": 2,
    "Q12H": 2,
}

FREQUENCY_ALIASES = {
    "QD": "ONCE_DAILY",
    "ONCE DAILY": "ONCE_DAILY",
    "BID": "TWICE_DAILY",
    "TWICE DAILY": "TWICE_DAILY",
    "TID": "THREE_TIMES_DAILY",
    "THREE TIMES DAILY": "THREE_TIMES_DAILY",
    "QID": "FOUR_TIMES_DAILY",
    "FOUR TIMES DAILY": "FOUR_TIMES_DAILY",
    "Q4H": "EVERY_4_HOURS",
    "EVERY 4 HOURS": "EVERY_4_HOURS",
    "Q6H": "EVERY_6_HOURS",
    "EVERY 6 HOURS": "EVERY_6_HOURS",
    "Q8H": "EVERY_8_HOURS",
    "EVERY 8 HOURS": "EVERY_8_HOURS",
    "Q12H": "EVERY_12_HOURS",
    "EVERY 12 HOURS": "EVERY_12_HOURS",
    "PRN": "PRN",
    "AS_NEEDED": "PRN",
    "AS NEEDED": "PRN",
    "STAT": "STAT",
    "CUSTOM": "CUSTOM",
    "CUSTOM_SCHEDULE": "CUSTOM",
    "CUSTOM SCHEDULE": "CUSTOM",
}


def normalize_frequency(frequency: str) -> str:
    """Normalize frequency input into canonical upper-case form."""
    raw = str(frequency or "ONCE_DAILY").strip().upper().replace("-", " ")
    return FREQUENCY_ALIASES.get(raw, raw.replace(" ", "_"))


def parse_time_str(time_val: Any) -> time:
    """Safely parse a time string or object into a time object."""
    if isinstance(time_val, time):
        return time_val
    t_str = str(time_val).split(".")[0].strip()
    if len(t_str) == 5:  # HH:MM
        return datetime.strptime(t_str, "%H:%M").time()
    for fmt in ["%H:%M:%S", "%I:%M %p", "%I:%M%p"]:
        try:
            return datetime.strptime(t_str, fmt).time()
        except ValueError:
            continue
    return datetime.strptime(t_str[:5], "%H:%M").time()


def parse_date_val(date_val: Any) -> date:
    """Safely parse a date value or string into a date object."""
    if isinstance(date_val, date) and not isinstance(date_val, datetime):
        return date_val
    if isinstance(date_val, datetime):
        return date_val.date()
    return datetime.strptime(str(date_val)[:10], "%Y-%m-%d").date()


def combine_date_time(schedule_date, schedule_time) -> datetime:
    """Combine a date and time into one datetime."""
    d = parse_date_val(schedule_date)
    t = parse_time_str(schedule_time)
    return datetime.combine(d, t)


def generate_schedule_times(
    start_date,
    start_time,
    duration_days: int,
    frequency: str,
    administration_times: Optional[List[Any]] = None,
) -> list[datetime]:
    """
    Generate all scheduled medication times with support for:
    - Independent administration times
    - PRN orders (returns [] empty schedule; PRN is documented for nurse on-demand)
    - STAT orders (returns 1 immediate dose)
    - Custom schedules
    - Validation of count & spacing
    """
    if duration_days <= 0:
        raise ValueError("duration_days must be greater than zero.")

    canonical_freq = normalize_frequency(frequency)

    # 1. PRN (As Needed) - do not create routine fixed schedules in advance
    if canonical_freq == "PRN":
        return []

    first_datetime = combine_date_time(start_date, start_time)

    # 2. STAT / ONCE - single immediate dose
    if canonical_freq in {"STAT", "ONCE"}:
        return [first_datetime]

    parsed_start_date = parse_date_val(start_date)
    first_time_obj = parse_time_str(start_time)

    # 3. Handle Explicit Administration Times if provided by doctor
    clean_times: list[time] = []
    if administration_times and len(administration_times) > 0:
        raw_list = (
            administration_times
            if isinstance(administration_times, list)
            else [administration_times]
        )
        for t in raw_list:
            if t:
                try:
                    clean_times.append(parse_time_str(t))
                except Exception:
                    pass

    # Ensure first_time is in administration_times if clean_times was empty
    if not clean_times:
        clean_times = [first_time_obj]

    # Validate administration times count against frequency
    expected_count = FREQUENCY_DAILY_COUNTS.get(canonical_freq)
    if expected_count is not None and len(clean_times) > 1:
        if len(clean_times) != expected_count:
            raise ValueError(
                f"Frequency '{canonical_freq}' requires exactly {expected_count} administration time(s) per day, but {len(clean_times)} were provided."
            )

    # If multiple times were specified or CUSTOM schedule selected, generate daily doses for each time
    if len(clean_times) > 1 or canonical_freq == "CUSTOM" or (administration_times and len(administration_times) > 0):
        # Sort distinct times of day
        sorted_times = sorted(list(set(clean_times)))
        schedule_times: list[datetime] = []
        for day in range(duration_days):
            current_date = parsed_start_date + timedelta(days=day)
            for t in sorted_times:
                schedule_times.append(datetime.combine(current_date, t))
        return schedule_times

    # 4. Fallback interval generation for legacy or standard calls without explicit times
    if canonical_freq == "ONCE_DAILY":
        return [
            first_datetime + timedelta(days=day)
            for day in range(duration_days)
        ]

    if canonical_freq not in FREQUENCY_HOURS:
        # If it's a known frequency count without a direct hours key, calculate hours
        if expected_count and expected_count > 0:
            interval_hours = 24 // expected_count
        else:
            raise ValueError(f"Unsupported medication frequency: {frequency}")
    else:
        interval_hours = FREQUENCY_HOURS[canonical_freq]

    interval = timedelta(hours=interval_hours)
    end_datetime = first_datetime + timedelta(days=duration_days)
    schedule_times = []
    current_datetime = first_datetime

    while current_datetime < end_datetime:
        schedule_times.append(current_datetime)
        current_datetime += interval

    return schedule_times


def create_medication_schedule(
    prescription_item,
    db=None,
    patient_id: Optional[int] = None,
    prescription_id: Optional[int] = None,
    medicine_name: Optional[str] = None,
    dose: Optional[str] = None,
    route: Optional[str] = None,
) -> list[dict]:
    """
    Generate and save medication schedule records in MongoDB.
    Accepts either a dict or an object.
    """
    if isinstance(prescription_item, dict):
        item_id = prescription_item.get("id", prescription_item.get("_id"))
        p_id = prescription_id or prescription_item.get("prescription_id")
        pt_id = patient_id or prescription_item.get("patient_id")
        m_id = prescription_item.get("medicine_id")
        m_name = medicine_name or prescription_item.get("medicine_name")
        d_val = dose or prescription_item.get("dose")
        r_val = route or prescription_item.get("route")
        start_date = prescription_item.get("start_date")
        start_time = prescription_item.get("start_time")
        duration_days = prescription_item.get("duration_days", 1)
        frequency = prescription_item.get("frequency", "ONCE_DAILY")
        admin_times = prescription_item.get("administration_times", [])
        is_stat = prescription_item.get("is_stat", False)
        instructions = prescription_item.get("instructions")
    else:
        item_id = getattr(prescription_item, "id", None)
        p_id = prescription_id or getattr(prescription_item, "prescription_id", None)
        pt_id = patient_id or getattr(prescription_item, "patient_id", None)
        m_id = getattr(prescription_item, "medicine_id", None)
        m_name = medicine_name or getattr(prescription_item, "medicine_name", None)
        d_val = dose or getattr(prescription_item, "dose", None)
        r_val = route or getattr(prescription_item, "route", None)
        start_date = getattr(prescription_item, "start_date", None)
        start_time = getattr(prescription_item, "start_time", None)
        duration_days = getattr(prescription_item, "duration_days", 1)
        frequency = getattr(prescription_item, "frequency", "ONCE_DAILY")
        admin_times = getattr(prescription_item, "administration_times", [])
        is_stat = getattr(prescription_item, "is_stat", False)
        instructions = getattr(prescription_item, "instructions", None)

    schedule_times = generate_schedule_times(
        start_date=start_date,
        start_time=start_time,
        duration_days=duration_days,
        frequency=frequency,
        administration_times=admin_times,
    )

    schedule_records: list[dict] = []
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    for scheduled_datetime in schedule_times:
        new_id = next_mongo_id("medication_schedules")
        record = {
            "_id": new_id,
            "id": new_id,
            "prescription_id": p_id,
            "prescription_item_id": item_id,
            "patient_id": pt_id,
            "medicine_id": m_id,
            "medicine_name": m_name,
            "dose": d_val,
            "route": r_val,
            "scheduled_date": scheduled_datetime.date().isoformat(),
            "scheduled_time": scheduled_datetime.time().isoformat(),
            "status": "SCHEDULED",
            "is_stat": bool(is_stat),
            "instructions": instructions,
            "actual_administration_time": None,
            "administered_by": None,
            "notes": None,
            "created_at": now_str,
            "updated_at": now_str,
        }
        mongo_db.medication_schedules.insert_one(record)
        schedule_records.append(record)

    return schedule_records
