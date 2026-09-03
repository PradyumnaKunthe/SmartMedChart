from datetime import date, time, datetime

from sqlalchemy import select

from app.database import SessionLocal
from app.models import (
    MedicationAdministration,
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    Role,
    User,
)
from app.services.medication_administration_service import (
    record_medication_administration,
)


TEST_STATUSES = [
    "GIVEN",
    "DELAYED",
    "HELD",
    "REFUSED",
    "NOT_GIVEN",
]


db = SessionLocal()

try:
    nurse_role = db.scalar(
        select(Role).where(Role.name == "Nurse")
    )

    doctor_role = db.scalar(
        select(Role).where(Role.name == "Doctor")
    )

    if nurse_role is None or doctor_role is None:
        raise RuntimeError("Required roles were not found.")

    doctor = User(
        username="status_test_doctor",
        email="status_test_doctor@example.com",
        password_hash="TEST_ONLY",
        full_name="Status Test Doctor",
        role_id=doctor_role.id,
        is_active=True,
    )

    nurse = User(
        username="status_test_nurse",
        email="status_test_nurse@example.com",
        password_hash="TEST_ONLY",
        full_name="Status Test Nurse",
        role_id=nurse_role.id,
        is_active=True,
    )

    db.add_all([doctor, nurse])
    db.flush()

    patient = Patient(
        patient_id="STATUS-TEST-001",
        first_name="Status",
        last_name="Patient",
        gender="Other",
        weight_kg=70.0,
        is_active=True,
    )

    medicine = Medicine(
        name="Status Test Medicine",
        generic_name="Test Generic",
        strength="500 mg",
        dosage_form="Tablet",
        is_active=True,
    )

    db.add_all([patient, medicine])
    db.flush()

    prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        status="ACTIVE",
    )

    db.add(prescription)
    db.flush()

    prescription_item = PrescriptionItem(
        prescription_id=prescription.id,
        medicine_id=medicine.id,
        dose="500 mg",
        route="ORAL",
        frequency="ONCE",
        duration_days=1,
        start_date=date(2026, 8, 25),
        start_time=time(8, 0),
        is_stat=False,
        status="ACTIVE",
    )

    db.add(prescription_item)
    db.flush()

    for index, status in enumerate(TEST_STATUSES, start=1):
        schedule = MedicationSchedule(
            prescription_item_id=prescription_item.id,
            scheduled_date=date(2026, 8, 25),
            scheduled_time=time(8 + index, 0),
            status="DUE_NOW",
        )

        db.add(schedule)
        db.flush()

        administration = record_medication_administration(
            db=db,
            medication_schedule_id=schedule.id,
            administered_by=nurse.id,
            status=status,
            notes=f"Testing {status}",
            administered_at=datetime(2026, 8, 25, 8 + index, 5),
        )

        saved_schedule = db.scalar(
            select(MedicationSchedule).where(
                MedicationSchedule.id == schedule.id
            )
        )

        assert administration.status == status
        assert saved_schedule.status == status

        print(
            f"{status}: "
            f"Administration={administration.status}, "
            f"Schedule={saved_schedule.status}"
        )

    print("\nAll administration status tests passed successfully.")

finally:
    db.close()