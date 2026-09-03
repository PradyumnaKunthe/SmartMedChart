from datetime import datetime

from pydantic import BaseModel, Field


class MedicationAdministrationCreate(BaseModel):
    status: str = Field(
        ...,
        description="GIVEN, DELAYED, HELD, REFUSED, or NOT_GIVEN",
    )

    administered_at: datetime | None = None

    notes: str | None = None