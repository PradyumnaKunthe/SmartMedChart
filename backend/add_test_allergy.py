from sqlalchemy import select

from app.database import SessionLocal
from app.models import Allergy, Patient


db = SessionLocal()

try:
    # Find patient 1
    patient = db.scalar(
        select(Patient).where(
            Patient.id == 1
        )
    )

    if patient is None:
        raise RuntimeError("Patient 1 was not found.")

    # Check whether this test allergy already exists
    existing = db.scalar(
        select(Allergy).where(
            Allergy.patient_id == patient.id,
            Allergy.allergen == "Penicillin",
        )
    )

    if existing is not None:
        print("Test allergy already exists.")
        print("Allergy ID:", existing.id)
    else:
        allergy = Allergy(
            patient_id=patient.id,
            allergen="Penicillin",
            reaction="Skin rash",
            severity="Severe",
            notes="Test allergy for SmartMedChart development.",
        )

        db.add(allergy)
        db.commit()
        db.refresh(allergy)

        print("Test allergy created successfully.")
        print("Allergy ID:", allergy.id)
        print("Patient ID:", allergy.patient_id)
        print("Allergen:", allergy.allergen)
        print("Reaction:", allergy.reaction)
        print("Severity:", allergy.severity)

finally:
    db.close()