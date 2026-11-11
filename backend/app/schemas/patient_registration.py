from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import (
    validate_dob_str,
    validate_email_str,
    validate_mobile_number,
    validate_non_empty_str,
)


class PatientRegistrationRequest(BaseModel):
    """Validated request body for the hospital patient-intake workflow.

    Extra fields are permitted for backward compatibility with integration
    tests and older client bundles, while core clinical and contact fields
    are strictly validated and normalized.
    """

    model_config = ConfigDict(
        extra="allow",
        str_strip_whitespace=True,
    )

    # Identity
    full_name: Optional[str] = Field(default=None, max_length=200)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    date_of_birth: Optional[str] = Field(default=None, max_length=15)
    gender: Optional[str] = Field(default=None, max_length=30)

    # Contact details
    mobile_number: Optional[str] = Field(default=None, max_length=25)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=1000)
    emergency_contact_name: Optional[str] = Field(default=None, max_length=150)
    emergency_contact_number: Optional[str] = Field(default=None, max_length=25)
    emergency_contact_relationship: Optional[str] = Field(default=None, max_length=60)
    preferred_language: Optional[str] = Field(default=None, max_length=60)

    # Initial encounter / clinical intake
    problem_category: Optional[str] = Field(default=None, max_length=100)
    chief_complaint: Optional[str] = Field(default=None, max_length=2000)
    symptom_duration: Optional[str] = Field(default=None, max_length=100)
    symptom_severity: Optional[str] = Field(default=None, max_length=30)
    visit_notes: Optional[str] = Field(default=None, max_length=5000)
    medical_history_notes: Optional[str] = Field(default=None, max_length=5000)
    current_medication_notes: Optional[str] = Field(default=None, max_length=5000)
    allergy_notes: Optional[str] = Field(default=None, max_length=5000)
    clinical_observations: Optional[dict[str, Any]] = None
    weight_kg: Optional[float] = Field(default=None, gt=0, le=500)

    # Doctor and optional admission details
    doctor_id: Optional[int] = Field(default=None, gt=0)
    is_admitted: bool = False
    ward_id: Optional[int] = Field(default=None, gt=0)
    bed_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("email")
    @classmethod
    def validate_patient_email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_str(v, required=False)

    @field_validator("mobile_number")
    @classmethod
    def validate_patient_mobile(cls, v: Optional[str]) -> Optional[str]:
        return validate_mobile_number(v, required=False)

    @field_validator("emergency_contact_number")
    @classmethod
    def validate_emergency_mobile(cls, v: Optional[str]) -> Optional[str]:
        return validate_mobile_number(v, required=False)

    @field_validator("date_of_birth")
    @classmethod
    def validate_patient_dob(cls, v: Optional[str]) -> Optional[str]:
        return validate_dob_str(v)

    @field_validator("first_name", "last_name", "full_name")
    @classmethod
    def validate_name_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() == "":
            return None
        return v.strip() if v else None
