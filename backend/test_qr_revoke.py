from sqlalchemy import select

from app.database import SessionLocal
from app.models import Patient


db = SessionLocal()

try:
    patient = db.scalar(
        select(Patient).where(
            Patient.id == 1
        )
    )

    if patient is None:
        raise RuntimeError("Patient 1 was not found.")

    if not patient.qr_token:
        raise RuntimeError("Patient 1 does not have a QR token.")

    # Temporarily deactivate the QR.
    patient.qr_is_active = False
    db.commit()

    print("Patient 1 QR deactivated successfully.")

finally:
    db.close()