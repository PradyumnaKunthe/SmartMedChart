from fastapi import APIRouter, Depends, HTTPException
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
from app.schemas.administration import (
    MedicationAdministrationCreate,
)
from app.schemas.medication import (
    MedicationScheduleResponse,
)
from app.security import require_permission
from app.services.medication_administration_service import (
    record_medication_administration,
)
from app.services.nurse_assignment_service import (
    get_assigned_patient_ids,
    is_patient_assigned,
)


router = APIRouter(
    prefix="/api/nurse",
    tags=["Nurse"],
)


# =========================================================
# BUILD MEDICATION RESPONSE
# =========================================================

def build_medication_response(
    schedule,
    patient,
    prescription_item,
    medicine,
):
    patient_name = None

    if patient is not None:
        patient_name = (
            f"{patient.first_name} {patient.last_name}"
        ).strip()

    return {
        # -------------------------------------------------
        # Schedule
        # -------------------------------------------------

        "id": schedule.id,

        "prescription_item_id": (
            schedule.prescription_item_id
        ),

        "scheduled_date": (
            schedule.scheduled_date
        ),

        "scheduled_time": (
            schedule.scheduled_time
        ),

        "status": (
            schedule.status
        ),

        "actual_administration_time": (
            schedule.actual_administration_time
        ),

        "administered_by": (
            schedule.administered_by
        ),

        "notes": (
            schedule.notes
        ),

        # -------------------------------------------------
        # Patient
        # -------------------------------------------------

        "patient_id": (
            patient.id
            if patient is not None
            else None
        ),

        "patient_name": patient_name,

        "patient_code": (
            patient.patient_id
            if patient is not None
            else None
        ),

        # -------------------------------------------------
        # Medicine
        # -------------------------------------------------

        "medicine_id": (
            medicine.id
            if medicine is not None
            else None
        ),

        "medicine_name": (
            medicine.name
            if medicine is not None
            else None
        ),

        "generic_name": (
            getattr(
                medicine,
                "generic_name",
                None,
            )
            if medicine is not None
            else None
        ),

        "strength": (
            getattr(
                medicine,
                "strength",
                None,
            )
            if medicine is not None
            else None
        ),

        "dosage_form": (
            getattr(
                medicine,
                "dosage_form",
                None,
            )
            if medicine is not None
            else None
        ),

        # -------------------------------------------------
        # Prescription Item
        # -------------------------------------------------

        "dose": (
            prescription_item.dose
            if prescription_item is not None
            else None
        ),

        "route": (
            prescription_item.route
            if prescription_item is not None
            else None
        ),

        "frequency": (
            prescription_item.frequency
            if prescription_item is not None
            else None
        ),

        "duration_days": (
            prescription_item.duration_days
            if prescription_item is not None
            else None
        ),

        "is_stat": (
            bool(
                prescription_item.is_stat
            )
            if prescription_item is not None
            else False
        ),

        "instructions": (
            prescription_item.instructions
            if prescription_item is not None
            else None
        ),
    }


# =========================================================
# GET ALL NURSE MEDICATIONS
# =========================================================

@router.get(
    "/medications",
    response_model=list[
        MedicationScheduleResponse
    ],
)
def get_nurse_medications(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return medication schedules available to the
    currently logged-in nurse.

    A nurse can see medication schedules only for
    patients assigned to that nurse.
    """

    # -------------------------------------------------
    # Get patients assigned to this nurse
    # -------------------------------------------------

    assigned_patient_ids = get_assigned_patient_ids(
        db=db,
        nurse_id=current_user.id,
    )

    # No assignments = no medication access
    if not assigned_patient_ids:
        return []

    # -------------------------------------------------
    # Load schedules
    # -------------------------------------------------

    rows = db.execute(
        select(
            MedicationSchedule,
            Patient,
            PrescriptionItem,
            Medicine,
        )

        # Schedule -> Prescription Item
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )

        # Prescription Item -> Prescription
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )

        # Prescription -> Patient
        .join(
            Patient,
            Patient.id
            == Prescription.patient_id,
        )

        # Prescription Item -> Medicine
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )

        # Only patients assigned to this nurse
        .where(
            Patient.id.in_(
                assigned_patient_ids
            )
        )

        # Ordering
        .order_by(
            Patient.patient_id,
            Medicine.name,
            MedicationSchedule.scheduled_date,
            MedicationSchedule.scheduled_time,
        )
    ).all()

    return [
        build_medication_response(
            schedule=schedule,
            patient=patient,
            prescription_item=prescription_item,
            medicine=medicine,
        )
        for (
            schedule,
            patient,
            prescription_item,
            medicine,
        ) in rows
    ]


# =========================================================
# GET ONE MEDICATION SCHEDULE
# =========================================================

@router.get(
    "/medications/{schedule_id}",
    response_model=MedicationScheduleResponse,
)
def get_medication(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return one medication schedule.

    The schedule is accessible only when its patient
    is assigned to the currently logged-in nurse.
    """

    row = db.execute(
        select(
            MedicationSchedule,
            Patient,
            PrescriptionItem,
            Medicine,
        )

        # Schedule -> Prescription Item
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )

        # Prescription Item -> Prescription
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )

        # Prescription -> Patient
        .join(
            Patient,
            Patient.id
            == Prescription.patient_id,
        )

        # Prescription Item -> Medicine
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )

        # Specific schedule
        .where(
            MedicationSchedule.id
            == schedule_id
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    (
        schedule,
        patient,
        prescription_item,
        medicine,
    ) = row

    # -------------------------------------------------
    # Nurse assignment security
    # -------------------------------------------------

    if not is_patient_assigned(
        db=db,
        nurse_id=current_user.id,
        patient_id=patient.id,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    return build_medication_response(
        schedule=schedule,
        patient=patient,
        prescription_item=prescription_item,
        medicine=medicine,
    )


# =========================================================
# ADMINISTER MEDICATION
# =========================================================

@router.post(
    "/medications/{schedule_id}/administer"
)
def administer_medication(
    schedule_id: int,
    request: MedicationAdministrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "ADMINISTER_MEDICATION"
        )
    ),
):
    """
    Record medication administration.

    Requirements:
    1. Schedule must exist.
    2. Patient must be assigned to this nurse.
    3. Successful patient QR verification must exist.
    4. Successful medication verification must exist.
    """

    # -----------------------------------------------------
    # 1. Find medication schedule
    # -----------------------------------------------------

    schedule = db.scalar(
        select(
            MedicationSchedule
        ).where(
            MedicationSchedule.id
            == schedule_id
        )
    )

    if schedule is None:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    # -----------------------------------------------------
    # 2. Find patient belonging to the schedule
    # -----------------------------------------------------

    patient_id = db.scalar(
        select(
            Patient.id
        )
        .join(
            Prescription,
            Prescription.patient_id
            == Patient.id,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .where(
            PrescriptionItem.id
            == schedule.prescription_item_id,
        )
    )

    if patient_id is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Patient for medication schedule "
                "not found."
            ),
        )

    # -----------------------------------------------------
    # 3. Check nurse assignment
    # -----------------------------------------------------

    if not is_patient_assigned(
        db=db,
        nurse_id=current_user.id,
        patient_id=patient_id,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    # -----------------------------------------------------
    # 4. Find latest successful QR verification
    # -----------------------------------------------------

    verification = db.scalar(
        select(
            QRVerification
        )
        .where(
            QRVerification.medication_schedule_id
            == schedule_id,

            QRVerification.verified_by
            == current_user.id,

            QRVerification.patient_qr_valid.is_(
                True
            ),

            QRVerification.medication_valid.is_(
                True
            ),

            QRVerification.result
            == "SUCCESS",
        )
        .order_by(
            desc(
                QRVerification.id
            )
        )
    )

    if verification is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Patient and medication QR verification "
                "must be completed before administration."
            ),
        )

    # -----------------------------------------------------
    # 5. Record administration
    # -----------------------------------------------------

    try:
        administration = (
            record_medication_administration(
                db=db,

                medication_schedule_id=(
                    schedule_id
                ),

                administered_by=(
                    current_user.id
                ),

                status=request.status,

                notes=request.notes,

                administered_at=(
                    request.administered_at
                ),
            )
        )

        return {
            "message": (
                "Medication administration "
                "recorded successfully."
            ),

            "administration_id": (
                administration.id
            ),

            "schedule_id": (
                schedule_id
            ),

            "status": (
                administration.status
            ),

            "administered_by": (
                administration.administered_by
            ),

            "administered_at": (
                administration.administered_at
            ),
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error