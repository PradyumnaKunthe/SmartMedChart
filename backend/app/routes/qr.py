from fastapi import APIRouter, Depends, HTTPException

from app.mongo_client import mongo_db
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
    current_user=Depends(
        require_permission("MANAGE_USERS")
    ),
):
    """
    Generate or regenerate a secure QR token for a patient.

    Only an authorized user can generate the patient QR.
    """

    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": patient_id},
            {"id": patient_id},
        ],
        "is_active": {"$in": [1, True]},
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    actual_patient_id = patient.get("id", patient.get("_id"))

    token = generate_patient_qr_token(
        patient_id=actual_patient_id
    )

    updated_patient = mongo_db.patients.find_one({
        "_id": actual_patient_id
    })

    return {
        "patient_id": actual_patient_id,
        "qr_token": token,
        "qr_data": token,
        "generated_at": updated_patient.get("qr_generated_at"),
    }