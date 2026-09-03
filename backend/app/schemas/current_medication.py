from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CurrentMedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_id: int
    prescription_item_id: int
    medicine_id: int

    medicine_name: str
    generic_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None

    dose: str
    route: str
    frequency: str
    duration_days: int

    start_date: date
    start_time: str

    is_stat: bool
    instructions: str | None = None
    status: str

    created_at: datetime
    updated_at: datetime