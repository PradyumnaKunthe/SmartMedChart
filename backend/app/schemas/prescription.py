from datetime import date, time
import re
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import validate_non_empty_str


TIME_FORMAT_REGEX = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$")


class PrescriptionItemCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    medicine_id: int = Field(
        ...,
        gt=0,
        description="ID of the prescribed formulary medicine",
    )

    dose: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Prescribed dose (e.g. '500 mg', '1 tablet')",
    )

    route: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Administration route (e.g. 'Oral', 'IV', 'IM')",
    )

    frequency: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Dosing frequency schedule (e.g. 'ONCE_DAILY', 'TWICE_DAILY')",
    )

    duration_days: int = Field(
        default=1,
        gt=0,
        le=365,
        description="Duration of the prescription regimen in days",
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

    @field_validator("dose")
    @classmethod
    def validate_item_dose(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Dose")

    @field_validator("route")
    @classmethod
    def validate_item_route(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Route")

    @field_validator("frequency")
    @classmethod
    def validate_item_frequency(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Frequency")

    @field_validator("administration_times")
    @classmethod
    def validate_times(cls, times: List[str]) -> List[str]:
        cleaned_times = []
        for t in times:
            t_str = str(t).strip()
            if not t_str:
                continue
            if not TIME_FORMAT_REGEX.match(t_str):
                raise ValueError(f"Invalid administration time format '{t_str}'. Expected HH:MM.")
            # Normalize to HH:MM
            cleaned_times.append(t_str[:5])
        return cleaned_times


class PrescriptionCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    patient_id: int = Field(
        ...,
        gt=0,
        description="Active inpatient ID receiving the prescription",
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    admit_patient: bool = False

    ward_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    bed_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    nurse_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional ID of the registered nurse assigned to the patient upon inpatient admission.",
    )

    replaces_prescription_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional ID of an existing active prescription that is being replaced and superseded by this new order.",
    )

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
