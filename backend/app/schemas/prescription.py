from datetime import date, time

from pydantic import BaseModel, Field


class PrescriptionCreate(BaseModel):
    patient_id: int = Field(
        ...,
        gt=0,
    )

    medicine_id: int = Field(
        ...,
        gt=0,
    )

    dose: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    route: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    frequency: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    duration_days: int = Field(
        ...,
        gt=0,
        le=365,
    )

    start_date: date

    start_time: time

    is_stat: bool = False

    instructions: str | None = Field(
        default=None,
        max_length=1000,
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )

    admit_patient: bool = False

    ward_id: int | None = None

    bed_id: int | None = None
