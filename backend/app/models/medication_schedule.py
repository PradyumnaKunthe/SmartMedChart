from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)

    prescription_item_id: Mapped[int] = mapped_column(
        ForeignKey("prescription_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    scheduled_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    scheduled_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )
    
    status: Mapped[str] = mapped_column(
        String(30),
        default="UPCOMING",
        nullable=False,
    )

    actual_administration_time: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    administered_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    prescription_item = relationship(
        "PrescriptionItem",
        back_populates="medication_schedules",
    )

    administrator = relationship(
        "User",
        back_populates="medication_schedules",
    )
    administrations = relationship(
        "MedicationAdministration",
        back_populates="medication_schedule",
        cascade="all, delete-orphan",
    )
    qr_verifications = relationship(
    "QRVerification",
    back_populates="medication_schedule",
    )
    ai_predictions = relationship(
    "AIPrediction",
    back_populates="medication_schedule",
)