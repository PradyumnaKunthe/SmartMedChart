from pydantic import BaseModel, Field


class SafetyWarning(BaseModel):
    type: str
    severity: str
    message: str
    reason: str

    allergen: str | None = None
    reaction: str | None = None
    allergy_severity: str | None = None
    notes: str | None = None


class MedicationSafetyResponse(BaseModel):
    safe: bool
    severity: str

    schedule_id: int
    patient_id: int

    medicine_id: int
    medicine_name: str

    warning_count: int = Field(
        ge=0
    )

    warnings: list[SafetyWarning]

    message: str