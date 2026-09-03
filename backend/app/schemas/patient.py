from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PatientSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: str
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    weight_kg: float | None = None
    ward_id: int | None = None
    bed_id: int | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime