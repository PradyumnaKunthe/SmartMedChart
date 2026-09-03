from sqlalchemy import select

from app.database import SessionLocal
from app.models import Patient
from app.services.qr_service import create_patient_qr_image


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
        raise RuntimeError(
            "Patient 1 does not have a QR token."
        )

    image_bytes = create_patient_qr_image(
        patient.qr_token
    )

    with open(
        "patient_1_qr.png",
        "wb",
    ) as file:
        file.write(image_bytes)

    print("QR image generated successfully.")
    print("Patient ID:", patient.id)
    print("Image file: patient_1_qr.png")
    print("Image size:", len(image_bytes), "bytes")

finally:
    db.close()