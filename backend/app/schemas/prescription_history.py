from datetime import datetime
from typing import List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class PrescriptionHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[int] = None
    prescription_item_id: Optional[int] = None
    prescription_id: Optional[int] = None

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

    start_date: str
    start_time: str

    administration_times: List[str] = Field(default_factory=list)
    is_stat: bool = False
    instructions: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    item_status: Optional[str] = "ACTIVE"


class PrescriptionHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")

    id: Optional[int] = None
    prescription_id: int
    patient_id: int
    doctor_id: int
    doctor_name: Optional[str] = None

    status: str = "ACTIVE"
    prescription_status: Optional[str] = None
    is_active: bool = True

    notes: Optional[str] = None
    prescription_notes: Optional[str] = None
    replaces_prescription_id: Optional[int] = None
    superseded_by: Optional[int] = None

    items: List[PrescriptionHistoryItem] = Field(default_factory=list)

    # Legacy flat fields for single-medicine backward compatibility
    prescription_item_id: Optional[int] = None
    medicine_id: Optional[int] = None
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    dose: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    duration_days: Optional[int] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    is_stat: Optional[bool] = False
    instructions: Optional[str] = None
    item_status: Optional[str] = None

    created_at: Union[datetime, str]
    updated_at: Union[datetime, str]
