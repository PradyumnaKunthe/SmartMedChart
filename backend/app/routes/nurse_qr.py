from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    QRVerification,
    User,
)
from app.schemas.medication_verification import (
    MedicationVerificationRequest,
    MedicationVerificationResponse,
)
from app.schemas.qr import QRVerifyRequest, QRVerifyResponse
from app.security import require_permission
from app.services.nurse_assignment_service import (
    is_patient_assigned,
)


router = APIRouter(
    prefix="/api/nurse/qr",
    tags=["Nurse QR"],
)


# =========================================================
# VERIFY PATIENT QR
# =========================================================

@router.post(
    "/verify",
    response_model=QRVerifyResponse,
)
def verify_patient_qr(
    request: QRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VERIFY_QR")
    ),
):
    """
    Verify a patient's QR token.

    A nurse can verify the QR only when the patient
    is actively assigned to that nurse.
    """

    # -----------------------------------------------------
    # 1. Find patient from QR token
    # -----------------------------------------------------

    patient = db.scalar(
        select(Patient).where(
            Patient.qr_token == request.qr_token,
            Patient.qr_is_active.is_(True),
            Patient.is_active.is_(True),
        )
    )

    # -----------------------------------------------------
    # 2. Invalid or inactive QR
    # -----------------------------------------------------

    if patient is None:
        return QRVerifyResponse(
            valid=False,
            patient_id=None,
            message="Invalid or inactive patient QR.",
        )

    # -----------------------------------------------------
    # 3. Check nurse assignment
    # -----------------------------------------------------

    if not is_patient_assigned(
        db=db,
        nurse_id=current_user.id,
        patient_id=patient.id,
    ):
        return QRVerifyResponse(
            valid=False,
            patient_id=patient.id,
            message=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    # -----------------------------------------------------
    # 4. Save successful patient verification
    # -----------------------------------------------------

    verification = QRVerification(
        patient_id=patient.id,
        medication_schedule_id=None,
        verified_by=current_user.id,
        verified_at=datetime.now(timezone.utc),
        patient_qr_valid=True,
        medication_valid=None,
        result="SUCCESS",
        message="Patient QR verified successfully.",
    )

    db.add(verification)
    db.commit()
    db.refresh(verification)

    return QRVerifyResponse(
        valid=True,
        patient_id=patient.id,
        message="Patient QR verified successfully.",
    )


# =========================================================
# VERIFY MEDICATION
# =========================================================

@router.post(
    "/verify-medication",
    response_model=MedicationVerificationResponse,
)
def verify_medication(
    request: MedicationVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VERIFY_QR")
    ),
):
    """
    Verify that a medication schedule belongs to
    the selected patient and that the patient is
    assigned to the logged-in nurse.
    """

    # -----------------------------------------------------
    # 1. Verify patient
    # -----------------------------------------------------

    patient = db.scalar(
        select(Patient).where(
            Patient.id == request.patient_id,
            Patient.is_active.is_(True),
        )
    )

    if patient is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=request.patient_id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message="Patient not found or inactive.",
        )

    # -----------------------------------------------------
    # 2. Check nurse assignment
    # -----------------------------------------------------

    if not is_patient_assigned(
        db=db,
        nurse_id=current_user.id,
        patient_id=patient.id,
    ):
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    # -----------------------------------------------------
    # 3. Verify medication schedule
    # -----------------------------------------------------

    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id
            == request.medication_schedule_id
        )
    )

    if schedule is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message="Medication schedule not found.",
        )

    # -----------------------------------------------------
    # 4. Get prescription item
    # -----------------------------------------------------

    prescription_item = db.scalar(
        select(PrescriptionItem).where(
            PrescriptionItem.id
            == schedule.prescription_item_id
        )
    )

    if prescription_item is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message="Prescription item not found.",
        )

    # -----------------------------------------------------
    # 5. Get prescription
    # -----------------------------------------------------

    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id
            == prescription_item.prescription_id
        )
    )

    if prescription is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message="Prescription not found.",
        )

    # -----------------------------------------------------
    # 6. Verify prescription belongs to patient
    # -----------------------------------------------------

    if prescription.patient_id != patient.id:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message=(
                "Medication does not belong "
                "to this patient."
            ),
        )

    # -----------------------------------------------------
    # 7. Prescription must be active
    # -----------------------------------------------------

    if prescription.status != "ACTIVE":
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message="Prescription is not active.",
        )

    # -----------------------------------------------------
    # 8. Prescription item must be active
    # -----------------------------------------------------

    if prescription_item.status != "ACTIVE":
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message="Prescription item is not active.",
        )

    # -----------------------------------------------------
    # 9. Find medicine
    # -----------------------------------------------------

    medicine = db.scalar(
        select(Medicine).where(
            Medicine.id
            == prescription_item.medicine_id
        )
    )

    if medicine is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            message="Medicine not found.",
        )

    # -----------------------------------------------------
    # 10. Medicine must be active
    # -----------------------------------------------------

    if not medicine.is_active:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient.id,
            medication_schedule_id=schedule.id,
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            message="Medicine is inactive.",
        )

    # -----------------------------------------------------
    # 11. Find latest successful patient QR verification
    # -----------------------------------------------------

    verification = db.scalar(
        select(QRVerification)
        .where(
            QRVerification.patient_id == patient.id,
            QRVerification.verified_by == current_user.id,
            QRVerification.patient_qr_valid.is_(True),
        )
        .order_by(
            desc(QRVerification.id)
        )
    )

    # -----------------------------------------------------
    # 12. Update verification record
    # -----------------------------------------------------

    if verification is not None:
        verification.medication_schedule_id = (
            schedule.id
        )

        verification.medication_valid = True

        verification.result = "SUCCESS"

        verification.message = (
            "Patient and medication verified successfully."
        )

        db.commit()
        db.refresh(verification)

    # -----------------------------------------------------
    # 13. Successful response
    # -----------------------------------------------------

    return MedicationVerificationResponse(
        valid=True,
        patient_id=patient.id,
        medication_schedule_id=schedule.id,
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        message="Medication verified for patient.",
    )