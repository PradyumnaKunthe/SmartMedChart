from datetime import date, datetime
from typing import Optional, Union

from pydantic import BaseModel, ConfigDict


class CurrentMedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")

    prescription_id: int
    prescription_item_id: int
    medicine_id: int

    medicine_name: str
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None

    dose: str
    dosage: Optional[str] = None
    route: str
    frequency: str
    duration_days: int

    start_date: Union[date, str]
    start_time: str

    is_stat: bool
    instructions: Optional[str] = None
    status: str

    created_at: Union[datetime, str]
    updated_at: Union[datetime, str]
