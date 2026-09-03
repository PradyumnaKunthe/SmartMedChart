from pydantic import BaseModel, Field


class MedicationVerificationRequest(BaseModel):
    patient_id: int = Field(
        ...,
        gt=0,
    )

    medication_schedule_id: int = Field(
        ...,
        gt=0,
    )


class MedicationVerificationResponse(BaseModel):
    valid: bool
    patient_id: int | None = None
    medication_schedule_id: int | None = None
    medicine_id: int | None = None
    medicine_name: str | None = None
    message: str