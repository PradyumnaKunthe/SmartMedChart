import io
import secrets
from datetime import datetime, timezone

import qrcode

from app.mongo_client import mongo_db


def generate_unique_qr_token() -> str:
    """
    Generate a cryptographically secure, unique QR token.
    """
    while True:
        token = secrets.token_urlsafe(32)

        existing_patient = mongo_db.patients.find_one({
            "qr_token": token
        })

        if existing_patient is None:
            return token


def generate_patient_qr_token(
    patient_id: int,
    db=None,
    patient=None,
) -> str:
    """
    Generate and save a new QR token for a patient in MongoDB.
    """
    token = generate_unique_qr_token()
    now = datetime.now(timezone.utc).isoformat()

    mongo_db.patients.update_one(
        {
            "$or": [
                {"_id": patient_id},
                {"id": patient_id},
            ]
        },
        {
            "$set": {
                "qr_token": token,
                "qr_generated_at": now,
                "qr_is_active": True,
                "updated_at": now,
            }
        },
    )

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