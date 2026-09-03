from pydantic import BaseModel, Field


class AllergyCreate(BaseModel):
    allergen: str = Field(
        min_length=1,
        max_length=150,
    )

    reaction: str | None = Field(
        default=None,
        max_length=255,
    )

    severity: str | None = Field(
        default=None,
        max_length=30,
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )


class AllergyUpdate(BaseModel):
    allergen: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    reaction: str | None = Field(
        default=None,
        max_length=255,
    )

    severity: str | None = Field(
        default=None,
        max_length=30,
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )


class AllergyResponse(BaseModel):
    id: int
    patient_id: int
    allergen: str
    reaction: str | None = None
    severity: str | None = None
    notes: str | None = None

    class Config:
        from_attributes = True