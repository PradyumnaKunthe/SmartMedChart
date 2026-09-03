from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    medication_schedule_id: Mapped[int] = mapped_column(
        ForeignKey("medication_schedules.id"),
        nullable=False,
        index=True,
    )

    delay_probability: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    delay_risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    delay_prediction: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    missed_probability: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    missed_risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    missed_prediction: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    delay_reasons: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    missed_reasons: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    model_version: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="delay-rf-v1 / missed-rf-v1",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    medication_schedule = relationship(
        "MedicationSchedule",
        back_populates="ai_predictions",
    )