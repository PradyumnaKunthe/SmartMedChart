from datetime import datetime
from pydantic import BaseModel, Field


class MedicationAdministrationCreate(BaseModel):
    status: str = Field(
        ...,
        description="GIVEN, GIVEN_ON_TIME, GIVEN_LATE, DELAYED, HELD, REFUSED, or NOT_GIVEN",
    )
    administered_at: datetime | None = None
    notes: str | None = None
    is_override: bool = False
    override_reason: str | None = None
    qr_verification_ref: int | None = None


class MedicationAlertAcknowledgeRequest(BaseModel):
    acknowledgement_note: str | None = None