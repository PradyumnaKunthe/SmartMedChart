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


db = SessionLocal()

try:
    # ---------------------------------------------------------
    # 1. Find Doctor and Nurse roles
    # ---------------------------------------------------------
    doctor_role = db.scalar(
        select(Role).where(Role.name == "Doctor")
    )

    nurse_role = db.scalar(
        select(Role).where(Role.name == "Nurse")
    )

    if doctor_role is None:
        raise RuntimeError("Doctor role not found.")

    if nurse_role is None:
        raise RuntimeError("Nurse role not found.")

    # ---------------------------------------------------------
    # 2. Create test doctor
    # ---------------------------------------------------------
    doctor = User(
        username="test_doctor_admin",
        email="testdoctor_admin@example.com",
        password_hash="TEST_ONLY",
        full_name="Test Doctor Admin",
        role_id=doctor_role.id,
        is_active=True,
    )

    db.add(doctor)
    db.flush()

    # ---------------------------------------------------------
    # 3. Create test nurse
    # ---------------------------------------------------------
    nurse = User(
        username="test_nurse_admin",
        email="testnurse_admin@example.com",
        password_hash="TEST_ONLY",
        full_name="Test Nurse Admin",
        role_id=nurse_role.id,
        is_active=True,
    )

    db.add(nurse)
    db.flush()

    # ---------------------------------------------------------
    # 4. Create test patient
    # ---------------------------------------------------------
    patient = Patient(
        patient_id="TEST-ADMIN-001",
        first_name="Administration",
        last_name="Patient",
        gender="Other",
        weight_kg=70.0,
        is_active=True,
    )

    db.add(patient)
    db.flush()

    # ---------------------------------------------------------
    # 5. Create test medicine
    # ---------------------------------------------------------
    medicine = Medicine(
        name="Test Medicine Administration",
        generic_name="Test Generic",
        strength="500 mg",
        dosage_form="Tablet",
        description="Test medicine for administration workflow",
        is_active=True,
    )

    db.add(medicine)
    db.flush()

    # ---------------------------------------------------------
    # 6. Create prescription
    # ---------------------------------------------------------
    prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        status="ACTIVE",
        notes="Test prescription",
    )

    db.add(prescription)
    db.flush()

    # ---------------------------------------------------------
    # 7. Create prescription item
    # ---------------------------------------------------------
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
        instructions="Test administration",
        status="ACTIVE",
    )

    db.add(prescription_item)
    db.flush()

    # ---------------------------------------------------------
    # 8. Create a scheduled medication
    # ---------------------------------------------------------
    schedule = MedicationSchedule(
        prescription_item_id=prescription_item.id,
        scheduled_date=date(2026, 8, 25),
        scheduled_time=time(8, 0),
        status="DUE_NOW",
    )

    db.add(schedule)
    db.flush()

    print(f"Created medication schedule: {schedule.id}")

    # ---------------------------------------------------------
    # 9. Record medication as GIVEN
    # ---------------------------------------------------------
    administration = record_medication_administration(
        db=db,
        medication_schedule_id=schedule.id,
        administered_by=nurse.id,
        status="GIVEN",
        notes="Medication administered successfully.",
        administered_at=datetime(2026, 8, 25, 8, 7),
    )

    print("\nAdministration created:")
    print(f"ID: {administration.id}")
    print(f"Status: {administration.status}")
    print(f"Nurse ID: {administration.administered_by}")
    print(f"Time: {administration.administered_at}")

    # ---------------------------------------------------------
    # 10. Reload schedule from database
    # ---------------------------------------------------------
    saved_schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == schedule.id
        )
    )

    print("\nUpdated medication schedule:")
    print(f"Status: {saved_schedule.status}")
    print(
        f"Actual administration time: "
        f"{saved_schedule.actual_administration_time}"
    )
    print(
        f"Administered by: "
        f"{saved_schedule.administered_by}"
    )

    # ---------------------------------------------------------
    # 11. Verify administration was saved
    # ---------------------------------------------------------
    saved_administration = db.scalar(
        select(MedicationAdministration).where(
            MedicationAdministration.id == administration.id
        )
    )

    print("\nDatabase verification:")
    print(
        f"Administration found: "
        f"{saved_administration is not None}"
    )

    # ---------------------------------------------------------
    # 12. Assertions
    # ---------------------------------------------------------
    assert administration.status == "GIVEN"
    assert administration.administered_by == nurse.id

    assert saved_schedule.status == "GIVEN"
    assert saved_schedule.administered_by == nurse.id
    assert saved_schedule.actual_administration_time == datetime(
        2026, 8, 25, 8, 7
    )

    assert saved_administration is not None

    print("\nMedication administration service test passed successfully.")

finally:
    db.close()