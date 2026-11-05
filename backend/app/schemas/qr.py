from datetime import datetime

from pydantic import BaseModel, Field


class QRGenerateResponse(BaseModel):
    patient_id: int
    qr_token: str
    qr_data: str
    generated_at: datetime


class QRVerifyRequest(BaseModel):
    qr_token: str = Field(
        ...,
        min_length=16,
        max_length=255,
    )


class QRVerifyResponse(BaseModel):
    valid: bool
    patient_id: int | None = None
    message: str
    patient_name: str | None = None
    patient_code: str | None = None
    ward_name: str | None = None
    bed_number: str | None = None