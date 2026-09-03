from sqlalchemy import select

from app.database import SessionLocal
from app.models import Medicine


db = SessionLocal()

try:
    medicine = db.scalar(
        select(Medicine).where(
            Medicine.id == 1
        )
    )

    if medicine is None:
        raise RuntimeError(
            "Medicine 1 was not found."
        )

    medicine.is_active = False
    db.commit()

    print("Inactive medicine test prepared.")
    print("Medicine ID:", medicine.id)
    print("Medicine name:", medicine.name)
    print("Medicine active:", medicine.is_active)

finally:
    db.close()