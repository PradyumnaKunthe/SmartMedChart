from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import validate_non_empty_str, validate_password_str


class LoginRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Active username for authentication",
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Account password",
    )

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return validate_non_empty_str(v, field_name="Username")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_str(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
