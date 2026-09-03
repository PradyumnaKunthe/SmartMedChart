from datetime import date, time

from pydantic import BaseModel, Field


class PrescriptionUpdate(BaseModel):
    dose: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    route: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    frequency: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    duration_days: int | None = Field(
        default=None,
        gt=0,
        le=365,
    )

    start_date: date | None = None

    start_time: time | None = None

    is_stat: bool | None = None

    instructions: str | None = Field(
        default=None,
        max_length=1000,
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )