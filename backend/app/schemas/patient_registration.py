from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PatientRegistrationRequest(BaseModel):
    """Validated request body for the hospital patient-intake workflow.

    Extra fields are allowed during the migration so older frontend builds and
    integrations can continue sending optional intake metadata without being
    rejected. The fields used by the current React form are explicitly typed.
    """

    model_config = ConfigDict(
        extra="allow",
        str_strip_whitespace=True,
    )

    # Identity
    full_name: str | None = Field(default=None, max_length=200)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    age: int | None = Field(default=None, ge=0, le=130)
    date_of_birth: str | None = Field(default=None, max_length=10)
    gender: str | None = Field(default=None, max_length=30)

    # Contact details
    mobile_number: str | None = Field(default=None, max_length=25)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)
    emergency_contact_name: str | None = Field(default=None, max_length=150)
    emergency_contact_number: str | None = Field(default=None, max_length=25)
    emergency_contact_relationship: str | None = Field(default=None, max_length=60)
    preferred_language: str | None = Field(default=None, max_length=60)

    # Initial encounter / clinical intake
    problem_category: str | None = Field(default=None, max_length=100)
    chief_complaint: str | None = Field(default=None, max_length=2000)
    symptom_duration: str | None = Field(default=None, max_length=100)
    symptom_severity: str | None = Field(default=None, max_length=30)
    visit_notes: str | None = Field(default=None, max_length=5000)
    medical_history_notes: str | None = Field(default=None, max_length=5000)
    current_medication_notes: str | None = Field(default=None, max_length=5000)
    allergy_notes: str | None = Field(default=None, max_length=5000)
    clinical_observations: dict[str, Any] | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=500)

    # Doctor and optional admission details
    doctor_id: int | None = Field(default=None, gt=0)
    is_admitted: bool = False
    ward_id: int | None = Field(default=None, gt=0)
    bed_id: int | None = Field(default=None, gt=0)
