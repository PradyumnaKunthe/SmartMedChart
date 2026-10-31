from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MedicineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, max_length=200)
    brand_name: str | None = Field(default=None, max_length=200)
    strength: str = Field(..., min_length=1, max_length=100)
    dosage_form: str = Field(..., min_length=1, max_length=100)
    unit: str = Field(default="Tablets", max_length=50)
    category: str = Field(default="General", max_length=100)
    min_stock_level: int = Field(default=10, ge=0)
    supplier: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class MedicineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, max_length=200)
    brand_name: str | None = Field(default=None, max_length=200)
    strength: str | None = Field(default=None, max_length=100)
    dosage_form: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    min_stock_level: int | None = Field(default=None, ge=0)
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
    batch_number: str = Field(..., min_length=1, max_length=100)
    expiry_date: str = Field(..., min_length=8, max_length=20)
    quantity: int = Field(..., gt=0)
    supplier: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=500)


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
    medicine_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    batch_id: int | None = None
    patient_id: int | None = None
    prescription_id: int | None = None
    notes: str | None = None
