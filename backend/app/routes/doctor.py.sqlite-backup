from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db

from app.models import (
    Allergy,
    Encounter,
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    User,
)

from app.schemas.allergy import AllergyResponse
from app.schemas.current_medication import CurrentMedicationResponse
from app.schemas.medicine import MedicineResponse
from app.schemas.medication import MedicationScheduleResponse
from app.schemas.patient import PatientSearchResponse
from app.schemas.prescription import PrescriptionCreate
from app.schemas.prescription_history import (
    PrescriptionHistoryResponse,
)
from app.schemas.prescription_update import (
    PrescriptionUpdate,
)

from app.security import require_permission

from app.services.scheduling_service import (
    create_medication_schedule,
)


router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor"],
)


# =========================================================
# Doctor patient access helper
# =========================================================

def get_doctor_patient_or_404(
    patient_id: int,
    db: Session,
    current_user: User,
) -> Patient:
    """
    Return a patient only when the patient is active and
    specifically assigned to the currently logged-in doctor
    through an active encounter.
    """

    patient = db.scalar(
        select(Patient)
        .join(
            Encounter,
            Encounter.patient_id == Patient.id,
        )
        .where(
            Patient.id == patient_id,
            Patient.is_active.is_(True),
            Encounter.doctor_id == current_user.id,
            Encounter.status == "ACTIVE",
        )
        .distinct()
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    return patient


# =========================================================
# Doctor API test
# =========================================================

@router.get("/test")
def doctor_test(
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    return {
        "message": "Doctor API access granted.",
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.name,
    }


# =========================================================
# Search patients
# =========================================================

@router.get(
    "/patients",
    response_model=list[PatientSearchResponse],
)
def search_patients(
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Show only patients specifically assigned to
    the currently logged-in doctor.
    """

    query = (
        select(Patient)
        .join(
            Encounter,
            Encounter.patient_id == Patient.id,
        )
        .where(
            Patient.is_active.is_(True),
            Encounter.doctor_id == current_user.id,
            Encounter.status == "ACTIVE",
        )
        .distinct()
    )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                Patient.patient_id.ilike(search_term),
                Patient.first_name.ilike(search_term),
                Patient.last_name.ilike(search_term),
            )
        )

    query = query.order_by(
        Patient.last_name,
        Patient.first_name,
    )

    return db.scalars(query).all()

# =========================================================
# Get single patient
# =========================================================

@router.get(
    "/patients/{patient_id}",
    response_model=PatientSearchResponse,
)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return a patient only when assigned to the current doctor.
    """

    return get_doctor_patient_or_404(
        patient_id=patient_id,
        db=db,
        current_user=current_user,
    )


# =========================================================
# Get patient allergies
# =========================================================

@router.get(
    "/patients/{patient_id}/allergies",
    response_model=list[AllergyResponse],
)
def get_patient_allergies(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return all allergies recorded for an active patient.
    """

    patient = get_doctor_patient_or_404(
        patient_id=patient_id,
        db=db,
        current_user=current_user,
    )

    allergies = db.scalars(
        select(Allergy)
        .where(
            Allergy.patient_id == patient_id
        )
        .order_by(Allergy.id)
    ).all()

    return allergies


# =========================================================
# Get current medications
# =========================================================

@router.get(
    "/patients/{patient_id}/medications",
    response_model=list[CurrentMedicationResponse],
)
def get_current_medications(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return active medications for an active patient.
    """

    patient = get_doctor_patient_or_404(
        patient_id=patient_id,
        db=db,
        current_user=current_user,
    )

    rows = db.execute(
        select(
            Prescription.id.label(
                "prescription_id"
            ),
            PrescriptionItem.id.label(
                "prescription_item_id"
            ),
            Medicine.id.label(
                "medicine_id"
            ),
            Medicine.name.label(
                "medicine_name"
            ),
            Medicine.generic_name.label(
                "generic_name"
            ),
            Medicine.strength.label(
                "strength"
            ),
            Medicine.dosage_form.label(
                "dosage_form"
            ),
            PrescriptionItem.dose,
            PrescriptionItem.route,
            PrescriptionItem.frequency,
            PrescriptionItem.duration_days,
            PrescriptionItem.start_date,
            PrescriptionItem.start_time,
            PrescriptionItem.is_stat,
            PrescriptionItem.instructions,
            PrescriptionItem.status,
            PrescriptionItem.created_at,
            PrescriptionItem.updated_at,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .where(
            Prescription.patient_id == patient_id,
            Prescription.status == "ACTIVE",
            PrescriptionItem.status == "ACTIVE",
            Medicine.is_active.is_(True),
        )
        .order_by(
            PrescriptionItem.start_date,
            Medicine.name,
        )
    ).all()

    return [
        {
            "prescription_id":
                row.prescription_id,
            "prescription_item_id":
                row.prescription_item_id,
            "medicine_id":
                row.medicine_id,
            "medicine_name":
                row.medicine_name,
            "generic_name":
                row.generic_name,
            "strength":
                row.strength,
            "dosage_form":
                row.dosage_form,
            "dose":
                row.dose,
            "route":
                row.route,
            "frequency":
                row.frequency,
            "duration_days":
                row.duration_days,
            "start_date":
                row.start_date,
            "start_time":
                row.start_time.isoformat(),
            "is_stat":
                row.is_stat,
            "instructions":
                row.instructions,
            "status":
                row.status,
            "created_at":
                row.created_at,
            "updated_at":
                row.updated_at,
        }
        for row in rows
    ]


# =========================================================
# Get patient medication schedules
# =========================================================

@router.get(
    "/patients/{patient_id}/medication-schedules",
    response_model=list[MedicationScheduleResponse],
)
def get_patient_medication_schedules(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return medication schedules for an active patient.

    This endpoint is used by the Doctor UI to select
    a real medication schedule for AI and safety review.
    """

    # -----------------------------------------------------
    # 1. Verify patient
    # -----------------------------------------------------

    patient = get_doctor_patient_or_404(
        patient_id=patient_id,
        db=db,
        current_user=current_user,
    )

    # -----------------------------------------------------
    # 2. Get schedules belonging to this patient
    # -----------------------------------------------------

    schedules = db.scalars(
        select(MedicationSchedule)
        .join(
            PrescriptionItem,
            MedicationSchedule.prescription_item_id
            == PrescriptionItem.id,
        )
        .join(
            Prescription,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .where(
            Prescription.patient_id == patient_id,
        )
        .order_by(
            MedicationSchedule.scheduled_date,
            MedicationSchedule.scheduled_time,
            MedicationSchedule.id,
        )
    ).all()

    return schedules


# =========================================================
# Medicine catalogue
# =========================================================

@router.get(
    "/medicines",
    response_model=list[MedicineResponse],
)
def get_medicines(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return all active medicines available
    in the medicine catalogue.
    """

    medicines = db.scalars(
        select(Medicine)
        .where(
            Medicine.is_active.is_(True)
        )
        .order_by(Medicine.name)
    ).all()

    return medicines


# =========================================================
# Create prescription
# =========================================================

@router.post("/prescriptions")
def create_prescription(
    request: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "CREATE_PRESCRIPTION"
        )
    ),
):
    """
    Create a prescription for a patient and automatically
    generate medication schedules.
    """

    # -----------------------------------------------------
    # 1. Verify patient
    # -----------------------------------------------------

    patient = get_doctor_patient_or_404(
        patient_id=request.patient_id,
        db=db,
        current_user=current_user,
    )

    # -----------------------------------------------------
    # 2. Verify medicine
    # -----------------------------------------------------

    medicine = db.scalar(
        select(Medicine).where(
            Medicine.id == request.medicine_id,
            Medicine.is_active.is_(True),
        )
    )

    if medicine is None:
        raise HTTPException(
            status_code=404,
            detail="Medicine not found.",
        )

    # -----------------------------------------------------
    # 3. Create prescription
    # -----------------------------------------------------

    prescription = Prescription(
        patient_id=patient.id,
        doctor_id=current_user.id,
        status="ACTIVE",
        notes=request.notes,
    )

    db.add(prescription)
    db.flush()

    # -----------------------------------------------------
    # 4. Create prescription item
    # -----------------------------------------------------

    prescription_item = PrescriptionItem(
        prescription_id=prescription.id,
        medicine_id=medicine.id,
        dose=request.dose,
        route=request.route,
        frequency=request.frequency.upper().strip(),
        duration_days=request.duration_days,
        start_date=request.start_date,
        start_time=request.start_time,
        is_stat=request.is_stat,
        instructions=request.instructions,
        status="ACTIVE",
    )

    db.add(prescription_item)
    db.flush()

    # -----------------------------------------------------
    # 5. Generate medication schedules
    # -----------------------------------------------------

    try:
        schedules = create_medication_schedule(
            db=db,
            prescription_item=prescription_item,
        )

    except ValueError as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    # -----------------------------------------------------
    # 6. Return result
    # -----------------------------------------------------

    return {
        "message":
            "Prescription created successfully.",
        "prescription_id":
            prescription.id,
        "prescription_item_id":
            prescription_item.id,
        "patient_id":
            patient.id,
        "doctor_id":
            current_user.id,
        "medicine_id":
            medicine.id,
        "medicine_name":
            medicine.name,
        "dose":
            prescription_item.dose,
        "route":
            prescription_item.route,
        "frequency":
            prescription_item.frequency,
        "duration_days":
            prescription_item.duration_days,
        "start_date":
            prescription_item.start_date,
        "start_time":
            prescription_item.start_time,
        "is_stat":
            prescription_item.is_stat,
        "schedule_count":
            len(schedules),
    }


# =========================================================
# Update prescription
# =========================================================

@router.put(
    "/prescriptions/{prescription_id}",
)
def update_prescription(
    prescription_id: int,
    request: PrescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "EDIT_PRESCRIPTION"
        )
    ),
):
    """
    Update an active prescription and regenerate its
    medication schedule.

    Existing administration records are preserved.
    """

    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id == prescription_id
        )
    )

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found.",
        )

    if prescription.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active prescriptions can be edited.",
        )

    prescription_item = db.scalar(
        select(PrescriptionItem).where(
            PrescriptionItem.prescription_id
            == prescription.id
        )
    )

    if prescription_item is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription item not found.",
        )

    if request.notes is not None:
        prescription.notes = request.notes

    update_data = request.model_dump(
        exclude_unset=True
    )

    update_data.pop(
        "notes",
        None,
    )

    for field, value in update_data.items():
        setattr(
            prescription_item,
            field,
            value,
        )

    if prescription_item.frequency:
        prescription_item.frequency = (
            prescription_item.frequency
            .upper()
            .strip()
        )

    existing_schedules = db.scalars(
        select(MedicationSchedule).where(
            MedicationSchedule.prescription_item_id
            == prescription_item.id
        )
    ).all()

    for schedule in existing_schedules:

        if schedule.administrations:
            continue

        db.delete(schedule)

    db.flush()

    try:
        schedules = create_medication_schedule(
            db=db,
            prescription_item=prescription_item,
        )

    except ValueError as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    return {
        "message":
            "Prescription updated successfully.",
        "prescription_id":
            prescription.id,
        "prescription_item_id":
            prescription_item.id,
        "patient_id":
            prescription.patient_id,
        "doctor_id":
            prescription.doctor_id,
        "medicine_id":
            prescription_item.medicine_id,
        "dose":
            prescription_item.dose,
        "route":
            prescription_item.route,
        "frequency":
            prescription_item.frequency,
        "duration_days":
            prescription_item.duration_days,
        "start_date":
            prescription_item.start_date,
        "start_time":
            prescription_item.start_time,
        "is_stat":
            prescription_item.is_stat,
        "instructions":
            prescription_item.instructions,
        "status":
            prescription_item.status,
        "schedule_count":
            len(schedules),
    }


# =========================================================
# Stop prescription
# =========================================================

@router.post(
    "/prescriptions/{prescription_id}/stop"
)
def stop_prescription(
    prescription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "STOP_PRESCRIPTION"
        )
    ),
):
    """
    Stop an active prescription.

    Historical administration records are preserved.
    Future unadministered schedules are removed.
    """

    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id == prescription_id
        )
    )

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found.",
        )

    if prescription.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active prescriptions can be stopped.",
        )

    prescription.status = "STOPPED"

    prescription_items = db.scalars(
        select(PrescriptionItem).where(
            PrescriptionItem.prescription_id
            == prescription.id
        )
    ).all()

    removed_schedules = 0

    for item in prescription_items:

        item.status = "STOPPED"

        schedules = db.scalars(
            select(MedicationSchedule).where(
                MedicationSchedule.prescription_item_id
                == item.id
            )
        ).all()

        for schedule in schedules:

            if schedule.administrations:
                continue

            db.delete(schedule)

            removed_schedules += 1

    db.commit()

    return {
        "message":
            "Prescription stopped successfully.",
        "prescription_id":
            prescription.id,
        "status":
            prescription.status,
        "removed_future_schedules":
            removed_schedules,
    }


# =========================================================
# Prescription history
# =========================================================

@router.get(
    "/patients/{patient_id}/prescriptions",
    response_model=list[PrescriptionHistoryResponse],
)
def get_prescription_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    """
    Return prescription history for an active patient.

    Both active and stopped prescriptions are included.
    """

    patient = get_doctor_patient_or_404(
        patient_id=patient_id,
        db=db,
        current_user=current_user,
    )

    rows = db.execute(
        select(
            Prescription.id.label(
                "prescription_id"
            ),
            PrescriptionItem.id.label(
                "prescription_item_id"
            ),
            Prescription.patient_id,
            Prescription.doctor_id,
            Medicine.id.label(
                "medicine_id"
            ),
            Medicine.name.label(
                "medicine_name"
            ),
            Medicine.generic_name.label(
                "generic_name"
            ),
            Medicine.strength.label(
                "strength"
            ),
            Medicine.dosage_form.label(
                "dosage_form"
            ),
            PrescriptionItem.dose,
            PrescriptionItem.route,
            PrescriptionItem.frequency,
            PrescriptionItem.duration_days,
            PrescriptionItem.start_date,
            PrescriptionItem.start_time,
            PrescriptionItem.is_stat,
            PrescriptionItem.instructions,
            Prescription.status.label(
                "prescription_status"
            ),
            PrescriptionItem.status.label(
                "item_status"
            ),
            Prescription.notes.label(
                "prescription_notes"
            ),
            Prescription.created_at,
            Prescription.updated_at,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .where(
            Prescription.patient_id == patient_id,
        )
        .order_by(
            Prescription.created_at.desc(),
            PrescriptionItem.id.desc(),
        )
    ).all()

    return [
        {
            "prescription_id":
                row.prescription_id,
            "prescription_item_id":
                row.prescription_item_id,
            "patient_id":
                row.patient_id,
            "doctor_id":
                row.doctor_id,
            "medicine_id":
                row.medicine_id,
            "medicine_name":
                row.medicine_name,
            "generic_name":
                row.generic_name,
            "strength":
                row.strength,
            "dosage_form":
                row.dosage_form,
            "dose":
                row.dose,
            "route":
                row.route,
            "frequency":
                row.frequency,
            "duration_days":
                row.duration_days,
            "start_date":
                row.start_date.isoformat(),
            "start_time":
                row.start_time.isoformat(),
            "is_stat":
                row.is_stat,
            "instructions":
                row.instructions,
            "prescription_status":
                row.prescription_status,
            "item_status":
                row.item_status,
            "prescription_notes":
                row.prescription_notes,
            "created_at":
                row.created_at,
            "updated_at":
                row.updated_at,
        }
        for row in rows
    ]