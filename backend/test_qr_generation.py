from sqlalchemy import select

from app.database import SessionLocal
from app.models import Patient
from app.services.qr_service import generate_patient_qr_token


db = SessionLocal()

try:
    # Find Patient 1
    patient = db.scalar(
        select(Patient).where(
            Patient.id == 1
        )
    )

    if patient is None:
        raise RuntimeError("Patient 1 was not found.")

    # Generate a new QR token
    token = generate_patient_qr_token(
        db=db,
        patient=patient,
    )

    print("QR token generated successfully.")
    print("Patient ID:", patient.id)
    print("QR is active:", patient.qr_is_active)
    print("QR generated at:", patient.qr_generated_at)
    print("Token length:", len(token))

finally:
    db.close()