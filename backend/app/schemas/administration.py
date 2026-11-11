from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import validate_non_empty_str


ALLOWED_ADMINISTRATION_STATUSES = {
    "GIVEN",
    "GIVEN_ON_TIME",
    "GIVEN_LATE",
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
}


class MedicationAdministrationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    status: str = Field(
        ...,
        description="GIVEN, GIVEN_ON_TIME, GIVEN_LATE, DELAYED, HELD, REFUSED, or NOT_GIVEN",
    )
    administered_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)
    is_override: bool = False
    override_reason: str | None = Field(default=None, max_length=1000)
    qr_verification_ref: int | None = Field(default=None, gt=0)

    @field_validator("status")
    @classmethod
    def validate_admin_status(cls, v: str) -> str:
        cleaned = validate_non_empty_str(v, field_name="Administration status").upper()
        if cleaned not in ALLOWED_ADMINISTRATION_STATUSES:
            raise ValueError(
                f"Invalid administration status '{cleaned}'. Allowed values: {', '.join(sorted(ALLOWED_ADMINISTRATION_STATUSES))}"
            )
        return cleaned


class MedicationAlertAcknowledgeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    acknowledgement_note: str | None = Field(default=None, max_length=1000)


class HospitalPolicyUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    policy_name: str | None = Field(default=None, min_length=1, max_length=150)
    on_time_grace_before_minutes: int | None = Field(default=None, ge=0, le=1440)
    on_time_grace_after_minutes: int | None = Field(default=None, ge=0, le=1440)
    missed_cutoff_minutes: int | None = Field(default=None, ge=1, le=10080)
    require_override_reason: bool | None = None

