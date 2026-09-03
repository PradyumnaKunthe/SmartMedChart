from datetime import date, time

from sqlalchemy import select

from app.database import SessionLocal
from app.models import (
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    Role,
    User,
)
from app.services.scheduling_service import create_medication_schedule


db = SessionLocal()

try:
   
    doctor_role = db.scalar(
        select(Role).where(Role.name == "Doctor")
    )

    if doctor_role is None:
        raise RuntimeError("Doctor role was not found.")

    doctor = User(
        username="test_doctor_schedule",
        email="testdoctor_schedule@example.com",
        password_hash="TEST_ONLY",
        full_name="Test Doctor",
        role_id=doctor_role.id,
        is_active=True,
    )

    db.add(doctor)
    db.flush()

    patient = Patient(
        patient_id="TEST-SCHED-001",
        first_name="Schedule",
        last_name="Patient",
        gender="Other",
        weight_kg=70.0,
        is_active=True,
    )

    db.add(patient)
    db.flush()

    medicine = Medicine(
        name="Test Paracetamol",
        generic_name="Paracetamol",
        strength="500 mg",
        dosage_form="Tablet",
        description="Test medicine for scheduling workflow",
        is_active=True,
    )

    db.add(medicine)
    db.flush()

    prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        status="ACTIVE",
        notes="Test prescription for scheduling",
    )

    db.add(prescription)
    db.flush()

    prescription_item = PrescriptionItem(
        prescription_id=prescription.id,
        medicine_id=medicine.id,
        dose="500 mg",
        route="ORAL",
        frequency="EVERY_8_HOURS",
        duration_days=2,
        start_date=date(2026, 8, 25),
        start_time=time(8, 0),
        is_stat=False,
        instructions="Take after food",
        status="ACTIVE",
    )

    db.add(prescription_item)
    db.flush()

    schedules = create_medication_schedule(
        db=db,
        prescription_item=prescription_item,
    )

    print("\nGenerated medication schedules:")
    for schedule in schedules:
        print(
            f"- {schedule.scheduled_date} "
            f"{schedule.scheduled_time} "
            f"[{schedule.status}]"
        )

    print(f"\nTotal schedules created: {len(schedules)}")

    saved_schedules = db.scalars(
        select(MedicationSchedule).where(
            MedicationSchedule.prescription_item_id
            == prescription_item.id
        )
    ).all()

    print(
        f"Schedules found in database: "
        f"{len(saved_schedules)}"
    )

finally:
    db.close()