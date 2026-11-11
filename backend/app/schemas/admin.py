from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import (
    validate_email_str,
    validate_non_empty_str,
    validate_password_str,
)


class StaffCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Staff full name",
    )

    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Unique staff username",
    )

    email: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Staff institutional email address",
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Staff account initial password (min 8 characters)",
    )

    role: str = Field(
        ...,
        min_length=4,
        max_length=30,
        description="Hospital role (Nurse, Doctor, or Receptionist)",
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Full name")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = validate_non_empty_str(v, field_name="Username")
        if len(cleaned) < 3:
            raise ValueError("Username must contain at least 3 characters.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        res = validate_email_str(v, required=True)
        if not res:
            raise ValueError("Please enter a valid email address.")
        return res

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_str(v)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        cleaned = validate_non_empty_str(v, field_name="Role").lower()
        allowed = {"nurse", "doctor", "receptionist"}
        if cleaned not in allowed:
            raise ValueError("Role must be Nurse, Doctor, or Receptionist.")
        return cleaned


class AssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    nurse_id: int = Field(
        ...,
        gt=0,
        description="Active registered nurse ID",
    )

    patient_id: int = Field(
        ...,
        gt=0,
        description="Active hospital inpatient ID",
    )


class DoctorAssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    doctor_id: int = Field(
        ...,
        gt=0,
        description="Active registered doctor ID",
    )

    patient_id: int = Field(
        ...,
        gt=0,
        description="Active hospital inpatient ID",
    )
