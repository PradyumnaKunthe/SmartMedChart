from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True)

    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    encounter_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="OPD",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        index=True,
    )
        # Structured patient visit intake
    chief_complaint: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    symptom_duration: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    symptom_severity: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    visit_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    medical_history_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    current_medication_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    allergy_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Optional structured observations
    clinical_observations: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    admitted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    discharged_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    discharge_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    discharged_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
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

    patient = relationship(
        "Patient",
        back_populates="encounters",
    )

    doctor = relationship(
        "User",
        foreign_keys=[doctor_id],
    )

    discharge_user = relationship(
        "User",
        foreign_keys=[discharged_by],
    )