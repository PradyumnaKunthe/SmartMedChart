from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel, Field


class PrescriptionItemCreate(BaseModel):
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
        default=1,
        gt=0,
        le=365,
    )

    start_date: date

    start_time: time

    administration_times: List[str] = Field(
        default_factory=list,
        description="Exact scheduled times of day for administration (e.g. ['08:00', '14:00', '20:00'])",
    )

    is_stat: bool = False

    instructions: Optional[str] = Field(
        default=None,
        max_length=1000,
    )


class PrescriptionCreate(BaseModel):
    patient_id: int = Field(
        ...,
        gt=0,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    admit_patient: bool = False

    ward_id: Optional[int] = None

    bed_id: Optional[int] = None

    # Multiple medicines per prescription
    medicines: List[PrescriptionItemCreate] = Field(
        default_factory=list,
        description="List of one or more medicines with independent dosage, route, frequency and timing",
    )

    # Legacy fields for single-medicine backward compatibility
    medicine_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    dose: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    route: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    frequency: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    duration_days: Optional[int] = Field(
        default=None,
        gt=0,
        le=365,
    )

    start_date: Optional[date] = None

    start_time: Optional[time] = None

    administration_times: List[str] = Field(
        default_factory=list,
    )

    is_stat: bool = False

    instructions: Optional[str] = Field(
        default=None,
        max_length=1000,
    )
