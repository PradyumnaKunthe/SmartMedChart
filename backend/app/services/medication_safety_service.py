from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Allergy,
    Medicine,
    MedicationSchedule,
    Patient,
    Prescription,
    PrescriptionItem,
)


def _text_matches_allergen(
    medicine_name: str,
    generic_name: str | None,
    allergen: str,
) -> bool:
    """
    Perform a simple case-insensitive text match.

    This is an MVP safety check and is NOT a
    clinical drug-allergy knowledge base.
    """

    medicine_text = (
        medicine_name or ""
    ).strip().lower()

    generic_text = (
        generic_name or ""
    ).strip().lower()

    allergen_text = (
        allergen or ""
    ).strip().lower()

    if not allergen_text:
        return False

    return (
        allergen_text in medicine_text
        or allergen_text in generic_text
        or medicine_text in allergen_text
        or generic_text in allergen_text
    )


def check_medication_safety(
    db: Session,
    schedule_id: int,
) -> dict:
    """
    Check a medication schedule for important safety
    conflicts before administration.
    """

    # -----------------------------------------------------
    # 1. Find medication schedule
    # -----------------------------------------------------

    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id
            == schedule_id
        )
    )

    if schedule is None:
        raise ValueError(
            "Medication schedule not found."
        )

    # -----------------------------------------------------
    # 2. Find prescription item
    # -----------------------------------------------------

    prescription_item = db.scalar(
        select(PrescriptionItem).where(
            PrescriptionItem.id
            == schedule.prescription_item_id
        )
    )

    if prescription_item is None:
        raise ValueError(
            "Prescription item not found."
        )

    # -----------------------------------------------------
    # 3. Find prescription
    # -----------------------------------------------------

    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id
            == prescription_item.prescription_id
        )
    )

    if prescription is None:
        raise ValueError(
            "Prescription not found."
        )

    # -----------------------------------------------------
    # 4. Find patient
    # -----------------------------------------------------

    patient = db.scalar(
        select(Patient).where(
            Patient.id
            == prescription.patient_id
        )
    )

    if patient is None:
        raise ValueError(
            "Patient not found."
        )

    # -----------------------------------------------------
    # 5. Find medicine
    # -----------------------------------------------------

    medicine = db.scalar(
        select(Medicine).where(
            Medicine.id
            == prescription_item.medicine_id
        )
    )

    if medicine is None:
        raise ValueError(
            "Medicine not found."
        )

    warnings = []

    # -----------------------------------------------------
    # 6. Prescription status check
    # -----------------------------------------------------

    if prescription.status != "ACTIVE":
        warnings.append(
            {
                "type": "PRESCRIPTION_INACTIVE",
                "severity": "HIGH",
                "message": (
                    "The prescription is not active."
                ),
                "reason": (
                    "Medication should not be administered "
                    "from an inactive prescription."
                ),
            }
        )

    # -----------------------------------------------------
    # 7. Prescription item status check
    # -----------------------------------------------------

    if prescription_item.status != "ACTIVE":
        warnings.append(
            {
                "type": "PRESCRIPTION_ITEM_INACTIVE",
                "severity": "HIGH",
                "message": (
                    "The prescription item is not active."
                ),
                "reason": (
                    "This medication item has been "
                    "deactivated."
                ),
            }
        )

    # -----------------------------------------------------
    # 8. Medicine status check
    # -----------------------------------------------------

    if not medicine.is_active:
        warnings.append(
            {
                "type": "MEDICINE_INACTIVE",
                "severity": "HIGH",
                "message": (
                    f"Medicine '{medicine.name}' is inactive."
                ),
                "reason": (
                    "The prescribed medicine is not "
                    "currently active in the medicine list."
                ),
            }
        )

    # -----------------------------------------------------
    # 9. Patient status check
    # -----------------------------------------------------

    if not patient.is_active:
        warnings.append(
            {
                "type": "PATIENT_INACTIVE",
                "severity": "HIGH",
                "message": (
                    "The patient record is inactive."
                ),
                "reason": (
                    "Medication administration should "
                    "not continue against an inactive "
                    "patient record."
                ),
            }
        )

    # -----------------------------------------------------
    # 10. Allergy checks
    # -----------------------------------------------------

    allergies = db.scalars(
        select(Allergy).where(
            Allergy.patient_id
            == patient.id
        )
    ).all()

    allergy_matches = []

    for allergy in allergies:
        if _text_matches_allergen(
            medicine_name=medicine.name,
            generic_name=medicine.generic_name,
            allergen=allergy.allergen,
        ):
            allergy_matches.append(
                allergy
            )

            severity = (
                allergy.severity
                or "UNSPECIFIED"
            )

            warnings.append(
                {
                    "type": "ALLERGY",
                    "severity": "HIGH",
                    "message": (
                        f"Patient has a recorded "
                        f"allergy to '{allergy.allergen}'."
                    ),
                    "reason": (
                        f"The prescribed medicine "
                        f"'{medicine.name}' matches "
                        f"the recorded allergen."
                    ),
                    "allergen": allergy.allergen,
                    "reaction": allergy.reaction,
                    "allergy_severity": severity,
                    "notes": allergy.notes,
                }
            )

    # -----------------------------------------------------
    # 11. Determine overall safety
    # -----------------------------------------------------

    high_count = sum(
        1
        for warning in warnings
        if warning["severity"] == "HIGH"
    )

    medium_count = sum(
        1
        for warning in warnings
        if warning["severity"] == "MEDIUM"
    )

    if high_count > 0:
        overall_severity = "HIGH"
        safe = False

    elif medium_count > 0:
        overall_severity = "MEDIUM"
        safe = False

    else:
        overall_severity = "NONE"
        safe = True

    # -----------------------------------------------------
    # 12. Return structured safety result
    # -----------------------------------------------------

    return {
        "safe": safe,
        "severity": overall_severity,

        "schedule_id": schedule.id,

        "patient_id": patient.id,

        "medicine_id": medicine.id,

        "medicine_name": medicine.name,

        "warnings": warnings,

        "warning_count": len(warnings),

        "message": (
            "No medication safety conflicts detected."
            if safe
            else
            "Medication safety warnings require clinical review."
        ),
    }