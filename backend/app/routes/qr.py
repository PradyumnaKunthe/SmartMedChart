from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, User
from app.schemas.qr import QRGenerateResponse
from app.security import require_permission
from app.services.qr_service import generate_patient_qr_token


router = APIRouter(
    prefix="/api/qr",
    tags=["QR"],
)


@router.post(
    "/patients/{patient_id}/generate",
    response_model=QRGenerateResponse,
)
def generate_patient_qr(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """
    Generate or regenerate a secure QR token for a patient.

    Only an authorized user can generate the patient QR.
    """

    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    token = generate_patient_qr_token(
        db=db,
        patient=patient,
    )

    return {
        "patient_id": patient.id,
        "qr_token": token,
        "qr_data": token,
        "generated_at": patient.qr_generated_at,
    }