from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NursePatientAssignment(Base):
    __tablename__ = "nurse_patient_assignments"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    nurse_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id"),
        nullable=False,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "nurse_id",
            "patient_id",
            name="uq_nurse_patient_assignment",
        ),
    )