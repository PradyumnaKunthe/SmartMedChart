import io
import secrets
from datetime import datetime, timezone

import qrcode
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient


def generate_unique_qr_token(
    db: Session,
) -> str:
    """
    Generate a cryptographically secure, unique QR token.
    """

    while True:
        token = secrets.token_urlsafe(32)

        existing_patient = db.scalar(
            select(Patient).where(
                Patient.qr_token == token
            )
        )

        if existing_patient is None:
            return token


def generate_patient_qr_token(
    db: Session,
    patient: Patient,
) -> str:
    """
    Generate and save a new QR token for a patient.
    """

    token = generate_unique_qr_token(db)

    patient.qr_token = token
    patient.qr_generated_at = datetime.now(timezone.utc)
    patient.qr_is_active = True

    db.commit()
    db.refresh(patient)

    return token


def create_patient_qr_image(
    token: str,
) -> bytes:
    """
    Create a PNG QR image containing only the secure token.
    """

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )

    qr.add_data(token)
    qr.make(fit=True)

    image = qr.make_image(
        fill_color="black",
        back_color="white",
    )

    output = io.BytesIO()

    image.save(
        output,
        format="PNG",
    )

    return output.getvalue()