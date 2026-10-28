from datetime import date, datetime
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)

    patient_id: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    gender: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    weight_kg: Mapped[float | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )

    ward_id: Mapped[int | None] = mapped_column(
        ForeignKey("wards.id", ondelete="SET NULL"),
        nullable=True,
    )

    bed_id: Mapped[int | None] = mapped_column(
        ForeignKey("beds.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
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

    ward = relationship(
        "Ward",
        back_populates="patients",
    )

    bed = relationship(
        "Bed",
        back_populates="patients",
    )

    allergies = relationship(
        "Allergy",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    prescriptions = relationship(
        "Prescription",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    qr_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )

    qr_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    qr_is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    qr_verifications = relationship(
    "QRVerification",
    back_populates="patient",
   )
    encounters = relationship(
        "Encounter",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    billing = relationship(
        "PatientBilling",
        back_populates="patient",
        uselist=False,
        cascade="all, delete-orphan",
    )