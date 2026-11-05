from pydantic import BaseModel, Field


class MedicationVerificationRequest(BaseModel):
    patient_id: int | str = Field(
        ...,
        description="Patient ID or alphanumeric patient code",
    )

    medication_schedule_id: int | str = Field(
        ...,
        description="Medication schedule numeric or string identifier",
    )


class MedicationVerificationResponse(BaseModel):
    valid: bool
    patient_id: int | str | None = None
    medication_schedule_id: int | str | None = None
    medicine_id: int | str | None = None
    medicine_name: str | None = None
    message: str
