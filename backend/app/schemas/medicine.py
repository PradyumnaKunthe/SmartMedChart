from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.validators import validate_non_empty_str


class MedicineCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, max_length=200)
    brand_name: str | None = Field(default=None, max_length=200)
    strength: str = Field(..., min_length=1, max_length=100)
    dosage_form: str = Field(..., min_length=1, max_length=100)
    unit: str = Field(default="Tablets", max_length=50)
    category: str = Field(default="General", max_length=100)
    min_stock_level: int = Field(default=10, ge=0, le=1000000)
    supplier: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Medicine name")

    @field_validator("strength")
    @classmethod
    def validate_strength(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Strength")

    @field_validator("dosage_form")
    @classmethod
    def validate_dosage_form(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Dosage form")


class MedicineUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, max_length=200)
    brand_name: str | None = Field(default=None, max_length=200)
    strength: str | None = Field(default=None, max_length=100)
    dosage_form: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    min_stock_level: int | None = Field(default=None, ge=0, le=1000000)
    supplier: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class MedicineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    generic_name: str | None = None
    brand_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    unit: str | None = None
    category: str | None = None
    min_stock_level: int | None = 10
    supplier: str | None = None
    total_stock: int | None = 0
    stock_status: str | None = "OUT OF STOCK"
    description: str | None = None
    is_active: bool
    is_archived: bool | None = False
    created_at: datetime | str | None = None
    updated_at: datetime | str | None = None


class BatchCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    batch_number: str = Field(..., min_length=1, max_length=100)
    expiry_date: str = Field(..., min_length=8, max_length=20)
    quantity: int = Field(..., gt=0, le=1000000)
    supplier: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("batch_number")
    @classmethod
    def validate_batch_num(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Batch number")


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medicine_id: int
    medicine_name: str | None = None
    batch_number: str
    expiry_date: str
    initial_quantity: int
    current_quantity: int
    supplier: str | None = None
    status: str
    created_at: datetime | str | None = None
    updated_at: datetime | str | None = None


class DispenseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    medicine_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, le=100000)
    batch_id: int | None = Field(default=None, gt=0)
    patient_id: int | None = Field(default=None, gt=0)
    prescription_id: int | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_dispense_order(self):
        if not self.prescription_id:
            if not self.notes or not self.notes.strip():
                raise ValueError("Clinical justification notes are mandatory when dispensing without a linked prescription order.")
        return self
