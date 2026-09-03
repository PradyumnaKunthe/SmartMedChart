from datetime import date, time

from app.services.scheduling_service import generate_schedule_times


schedule = generate_schedule_times(
    start_date=date(2026, 8, 25),
    start_time=time(8, 0),
    duration_days=1,
    frequency="STAT",
)

print("Generated STAT medication times:")

for item in schedule:
    print(item)