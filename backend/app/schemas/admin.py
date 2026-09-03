from pydantic import BaseModel, Field


class StaffCreateRequest(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    username: str = Field(
        min_length=3,
        max_length=50,
    )

    email: str = Field(
        min_length=5,
        max_length=255,
    )

    password: str = Field(
        min_length=8,
        max_length=255,
    )

    role: str = Field(
        min_length=4,
        max_length=30,
    )


class AssignmentCreateRequest(BaseModel):
    nurse_id: int

    patient_id: int