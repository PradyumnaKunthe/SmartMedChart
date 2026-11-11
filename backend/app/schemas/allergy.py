from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import validate_non_empty_str


class AllergyCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    allergen: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Name of drug, food, or substance allergen",
    )

    reaction: str | None = Field(
        default=None,
        max_length=255,
        description="Reported physiological allergic reaction",
    )

    severity: str | None = Field(
        default="MODERATE",
        max_length=30,
        description="Severity level (MILD, MODERATE, SEVERE, LIFE_THREATENING)",
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )

    @field_validator("allergen")
    @classmethod
    def validate_allergen_field(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Allergen")


class AllergyUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

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

    @field_validator("allergen")
    @classmethod
    def validate_allergen_field(cls, v: str | None) -> str | None:
        if v is not None:
            return validate_non_empty_str(v, field_name="Allergen")
        return v


class AllergyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    allergen: str
    reaction: str | None = None
    severity: str | None = None
    notes: str | None = None
