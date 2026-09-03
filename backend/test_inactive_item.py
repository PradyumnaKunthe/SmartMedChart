from sqlalchemy import select

from app.database import SessionLocal
from app.models import Prescription, PrescriptionItem


db = SessionLocal()

try:
    item = db.scalar(
        select(PrescriptionItem).where(
            PrescriptionItem.id == 1
        )
    )

    if item is None:
        raise RuntimeError(
            "Prescription item 1 was not found."
        )

    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id == item.prescription_id
        )
    )

    if prescription is None:
        raise RuntimeError(
            "Prescription was not found."
        )

    # Make sure the prescription itself stays active.
    prescription.status = "ACTIVE"

    # Temporarily deactivate only the prescription item.
    item.status = "STOPPED"

    db.commit()

    print("Inactive prescription-item test prepared.")
    print("Prescription ID:", prescription.id)
    print("Prescription status:", prescription.status)
    print("Prescription item ID:", item.id)
    print("Prescription item status:", item.status)

finally:
    db.close()
    