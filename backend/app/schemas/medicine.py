from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MedicineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    generic_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime