from datetime import date, time, datetime
import uuid

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

# Generate a unique ID so this test can be run repeatedly
# without violating UNIQUE constraints.
test_id = uuid.uuid4().hex[:8]

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
        raise RuntimeError("Doctor role was not found.")

    if nurse_role is None:
        raise RuntimeError("Nurse role was not found.")

    # ---------------------------------------------------------
    # 2. Create a unique test doctor
    # ---------------------------------------------------------
    doctor = User(
        username=f"duplicate_test_doctor_{test_id}",
        email=f"duplicate_test_doctor_{test_id}@example.com",
        password_hash="TEST_ONLY",
        full_name="Duplicate Test Doctor",
        role_id=doctor_role.id,
        is_active=True,
    )

    # ---------------------------------------------------------
    # 3. Create a unique test nurse
    # ---------------------------------------------------------
    nurse = User(
        username=f"duplicate_test_nurse_{test_id}",
        email=f"duplicate_test_nurse_{test_id}@example.com",
        password_hash="TEST_ONLY",
        full_name="Duplicate Test Nurse",
        role_id=nurse_role.id,
        is_active=True,
    )

    db.add_all([doctor, nurse])
    db.flush()

    # ---------------------------------------------------------
    # 4. Create a unique test patient
    # ---------------------------------------------------------
    patient = Patient(
        patient_id=f"DUPLICATE-TEST-{test_id}",
        first_name="Duplicate",
        last_name="Patient",
        gender="Other",
        is_active=True,
    )

    # ---------------------------------------------------------
    # 5. Create a unique test medicine
    # ---------------------------------------------------------
    medicine = Medicine(
        name=f"Duplicate Test Medicine {test_id}",
        strength="500 mg",
        dosage_form="Tablet",
        is_active=True,
    )

    db.add_all([patient, medicine])
    db.flush()

    # ---------------------------------------------------------
    # 6. Create prescription
    # ---------------------------------------------------------
    prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        status="ACTIVE",
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
        status="ACTIVE",
    )

    db.add(prescription_item)
    db.flush()

    # ---------------------------------------------------------
    # 8. Create one scheduled medication
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
    # 9. First administration should succeed
    # ---------------------------------------------------------
    first = record_medication_administration(
        db=db,
        medication_schedule_id=schedule.id,
        administered_by=nurse.id,
        status="GIVEN",
        notes="First administration.",
        administered_at=datetime(2026, 8, 25, 8, 5),
    )

    print(f"First administration: {first.status}")

    # ---------------------------------------------------------
    # 10. Second administration should fail
    # ---------------------------------------------------------
    duplicate_rejected = False

    try:
        record_medication_administration(
            db=db,
            medication_schedule_id=schedule.id,
            administered_by=nurse.id,
            status="GIVEN",
            notes="This should be rejected.",
            administered_at=datetime(2026, 8, 25, 8, 6),
        )

    except ValueError as error:
        duplicate_rejected = True
        print(f"Duplicate correctly rejected: {error}")

    # Confirm the duplicate attempt was actually rejected.
    assert duplicate_rejected, (
        "Duplicate administration was incorrectly allowed."
    )

    # ---------------------------------------------------------
    # 11. Confirm exactly one administration exists
    # ---------------------------------------------------------
    administrations = db.scalars(
        select(MedicationAdministration).where(
            MedicationAdministration.medication_schedule_id
            == schedule.id
        )
    ).all()

    count = len(administrations)

    print(f"Administration records found: {count}")

    assert count == 1, (
        f"Expected exactly 1 administration record, found {count}."
    )

    # ---------------------------------------------------------
    # 12. Confirm the original record is GIVEN
    # ---------------------------------------------------------
    saved_administration = administrations[0]

    assert saved_administration.status == "GIVEN"
    assert saved_administration.administered_by == nurse.id

    # ---------------------------------------------------------
    # 13. Confirm the schedule remains synchronized
    # ---------------------------------------------------------
    saved_schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == schedule.id
        )
    )

    assert saved_schedule is not None
    assert saved_schedule.status == "GIVEN"
    assert saved_schedule.administered_by == nurse.id
    assert (
        saved_schedule.actual_administration_time
        == datetime(2026, 8, 25, 8, 5)
    )

    print("Schedule synchronization verified.")
    print("Duplicate administration test passed successfully.")

finally:
    db.close()