from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PrescriptionHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_id: int
    prescription_item_id: int

    patient_id: int
    doctor_id: int

    medicine_id: int
    medicine_name: str
    generic_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None

    dose: str
    route: str
    frequency: str
    duration_days: int

    start_date: str
    start_time: str

    is_stat: bool
    instructions: str | None = None

    prescription_status: str
    item_status: str

    prescription_notes: str | None = None

    created_at: datetime
    updated_at: datetime