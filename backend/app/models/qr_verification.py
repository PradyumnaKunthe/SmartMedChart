from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QRVerification(Base):
    __tablename__ = "qr_verifications"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )

    medication_schedule_id: Mapped[int | None] = mapped_column(
        ForeignKey("medication_schedules.id"),
        nullable=True,
        index=True,
    )

    verified_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    verified_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    patient_qr_valid: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    medication_valid: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    result: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    patient = relationship(
        "Patient",
        back_populates="qr_verifications",
    )

    medication_schedule = relationship(
        "MedicationSchedule",
        back_populates="qr_verifications",
    )

    verified_by_user = relationship(
        "User",
        back_populates="qr_verifications",
    )
    