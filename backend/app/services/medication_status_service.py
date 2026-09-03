from datetime import date, datetime, time, timedelta


# How early a medication can be considered "UPCOMING".
# This is currently 30 minutes.
UPCOMING_WINDOW_MINUTES = 30

# How long after the scheduled time a medication remains "DUE NOW".
# This is currently 15 minutes.
DUE_WINDOW_MINUTES = 15


def combine_schedule_datetime(
    scheduled_date: date,
    scheduled_time: time,
) -> datetime:
    """Combine scheduled date and time into one datetime."""
    return datetime.combine(scheduled_date, scheduled_time)


def calculate_medication_status(
    scheduled_date: date,
    scheduled_time: time,
    administration_status: str | None = None,
    now: datetime | None = None,
) -> str:
    """
    Determine the current status of a medication schedule.

    Possible results:
        UPCOMING
        DUE_NOW
        OVERDUE
        COMPLETED
        HELD
        REFUSED
        NOT_GIVEN
        DELAYED
    """

    if now is None:
        now = datetime.now()

    # If administration has already been recorded,
    # that result takes priority over time-based status.
    if administration_status:
        administration_status = administration_status.upper().strip()

        if administration_status == "GIVEN":
            return "COMPLETED"

        if administration_status == "HELD":
            return "HELD"

        if administration_status == "REFUSED":
            return "REFUSED"

        if administration_status == "NOT_GIVEN":
            return "NOT_GIVEN"

        if administration_status == "DELAYED":
            return "DELAYED"

    scheduled_datetime = combine_schedule_datetime(
        scheduled_date,
        scheduled_time,
    )

    upcoming_start = (
        scheduled_datetime
        - timedelta(minutes=UPCOMING_WINDOW_MINUTES)
    )

    due_end = (
        scheduled_datetime
        + timedelta(minutes=DUE_WINDOW_MINUTES)
    )

    if now < upcoming_start:
        return "UPCOMING"

    if upcoming_start <= now <= due_end:
        return "DUE_NOW"

    return "OVERDUE"