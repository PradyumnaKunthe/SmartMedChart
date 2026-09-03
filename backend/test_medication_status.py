from datetime import date, datetime, time

from app.services.medication_status_service import (
    calculate_medication_status,
)


SCHEDULE_DATE = date(2026, 8, 25)
SCHEDULE_TIME = time(10, 0)


test_cases = [
    (
        "Before upcoming window",
        datetime(2026, 8, 25, 9, 0),
        None,
        "UPCOMING",
    ),
    (
        "Upcoming",
        datetime(2026, 8, 25, 9, 45),
        None,
        "DUE_NOW",
    ),
    (
        "Exactly scheduled",
        datetime(2026, 8, 25, 10, 0),
        None,
        "DUE_NOW",
    ),
    (
        "Still due",
        datetime(2026, 8, 25, 10, 10),
        None,
        "DUE_NOW",
    ),
    (
        "Overdue",
        datetime(2026, 8, 25, 10, 30),
        None,
        "OVERDUE",
    ),
    (
        "Given",
        datetime(2026, 8, 25, 10, 30),
        "GIVEN",
        "COMPLETED",
    ),
    (
        "Held",
        datetime(2026, 8, 25, 10, 30),
        "HELD",
        "HELD",
    ),
    (
        "Refused",
        datetime(2026, 8, 25, 10, 30),
        "REFUSED",
        "REFUSED",
    ),
    (
        "Not Given",
        datetime(2026, 8, 25, 10, 30),
        "NOT_GIVEN",
        "NOT_GIVEN",
    ),
    (
        "Delayed",
        datetime(2026, 8, 25, 10, 30),
        "DELAYED",
        "DELAYED",
    ),
]


for name, now, administration_status, expected in test_cases:
    result = calculate_medication_status(
        scheduled_date=SCHEDULE_DATE,
        scheduled_time=SCHEDULE_TIME,
        administration_status=administration_status,
        now=now,
    )

    print(
        f"{name}: "
        f"Expected={expected}, "
        f"Actual={result}"
    )

    assert result == expected


print("\nAll medication status tests passed successfully.")