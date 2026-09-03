from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Allergy, Patient, User
from app.schemas.allergy import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
)
from app.security import require_permission


router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor Allergies"],
)


# =========================================================
# ADD ALLERGY
# =========================================================

@router.post(
    "/patients/{patient_id}/allergies",
    response_model=AllergyResponse,
)
def create_patient_allergy(
    patient_id: int,
    request: AllergyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
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

    allergy = Allergy(
        patient_id=patient.id,
        allergen=request.allergen.strip(),
        reaction=(
            request.reaction.strip()
            if request.reaction
            else None
        ),
        severity=(
            request.severity.strip().upper()
            if request.severity
            else None
        ),
        notes=(
            request.notes.strip()
            if request.notes
            else None
        ),
    )

    db.add(allergy)
    db.commit()
    db.refresh(allergy)

    return allergy


# =========================================================
# UPDATE ALLERGY
# =========================================================

@router.put(
    "/patients/{patient_id}/allergies/{allergy_id}",
    response_model=AllergyResponse,
)
def update_patient_allergy(
    patient_id: int,
    allergy_id: int,
    request: AllergyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    allergy = db.scalar(
        select(Allergy).where(
            Allergy.id == allergy_id,
            Allergy.patient_id == patient_id,
        )
    )

    if allergy is None:
        raise HTTPException(
            status_code=404,
            detail="Allergy not found.",
        )

    update_data = request.model_dump(
        exclude_unset=True
    )

    if "allergen" in update_data:
        allergy.allergen = (
            update_data["allergen"].strip()
            if update_data["allergen"]
            else allergy.allergen
        )

    if "reaction" in update_data:
        allergy.reaction = (
            update_data["reaction"].strip()
            if update_data["reaction"]
            else None
        )

    if "severity" in update_data:
        allergy.severity = (
            update_data["severity"].strip().upper()
            if update_data["severity"]
            else None
        )

    if "notes" in update_data:
        allergy.notes = (
            update_data["notes"].strip()
            if update_data["notes"]
            else None
        )

    db.commit()
    db.refresh(allergy)

    return allergy


# =========================================================
# DELETE ALLERGY
# =========================================================

@router.delete(
    "/patients/{patient_id}/allergies/{allergy_id}"
)
def delete_patient_allergy(
    patient_id: int,
    allergy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    allergy = db.scalar(
        select(Allergy).where(
            Allergy.id == allergy_id,
            Allergy.patient_id == patient_id,
        )
    )

    if allergy is None:
        raise HTTPException(
            status_code=404,
            detail="Allergy not found.",
        )

    db.delete(allergy)
    db.commit()

    return {
        "message": "Allergy removed successfully.",
        "allergy_id": allergy_id,
    }