from app.mongo_client import mongo_db


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
    schedule_id: int,
    db=None,
) -> dict:
    """
    Check a medication schedule for important safety
    conflicts before administration using MongoDB collections.
    """

    # -----------------------------------------------------
    # 1. Find medication schedule
    # -----------------------------------------------------

    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": schedule_id},
            {"id": schedule_id},
        ]
    })

    if schedule is None:
        raise ValueError(
            "Medication schedule not found."
        )

    actual_schedule_id = int(schedule.get("id", schedule.get("_id")))
    prescription_item_id = int(schedule["prescription_item_id"])

    # -----------------------------------------------------
    # 2. Find prescription item
    # -----------------------------------------------------

    prescription_item = mongo_db.prescription_items.find_one({
        "$or": [
            {"_id": prescription_item_id},
            {"id": prescription_item_id},
        ]
    })

    if prescription_item is None:
        raise ValueError(
            "Prescription item not found."
        )

    prescription_id = int(prescription_item["prescription_id"])
    medicine_id = int(prescription_item["medicine_id"])

    # -----------------------------------------------------
    # 3. Find prescription
    # -----------------------------------------------------

    prescription = mongo_db.prescriptions.find_one({
        "$or": [
            {"_id": prescription_id},
            {"id": prescription_id},
        ]
    })

    if prescription is None:
        raise ValueError(
            "Prescription not found."
        )

    patient_id = int(prescription["patient_id"])

    # -----------------------------------------------------
    # 4. Find patient
    # -----------------------------------------------------

    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": patient_id},
            {"id": patient_id},
        ]
    })

    if patient is None:
        raise ValueError(
            "Patient not found."
        )

    # -----------------------------------------------------
    # 5. Find medicine
    # -----------------------------------------------------

    medicine = mongo_db.medicines.find_one({
        "$or": [
            {"_id": medicine_id},
            {"id": medicine_id},
        ]
    })

    if medicine is None:
        raise ValueError(
            "Medicine not found."
        )

    warnings = []

    # -----------------------------------------------------
    # 6. Prescription status check
    # -----------------------------------------------------

    if prescription.get("status") != "ACTIVE":
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

    if prescription_item.get("status", "ACTIVE") != "ACTIVE":
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

    if not (medicine.get("is_active") in (1, True)):
        warnings.append(
            {
                "type": "MEDICINE_INACTIVE",
                "severity": "HIGH",
                "message": (
                    f"Medicine '{medicine.get('name')}' is inactive."
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

    if not (patient.get("is_active") in (1, True)):
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

    allergies = list(
        mongo_db.patient_allergies.find({
            "patient_id": patient_id
        })
    )

    for allergy in allergies:
        if _text_matches_allergen(
            medicine_name=medicine.get("name", ""),
            generic_name=medicine.get("generic_name"),
            allergen=allergy.get("allergen", ""),
        ):
            severity = (
                allergy.get("severity")
                or "UNSPECIFIED"
            )

            warnings.append(
                {
                    "type": "ALLERGY",
                    "severity": "HIGH",
                    "message": (
                        f"Patient has a recorded "
                        f"allergy to '{allergy.get('allergen')}'."
                    ),
                    "reason": (
                        f"The prescribed medicine "
                        f"'{medicine.get('name')}' matches "
                        f"the recorded allergen."
                    ),
                    "allergen": allergy.get("allergen"),
                    "reaction": allergy.get("reaction"),
                    "allergy_severity": severity,
                    "notes": allergy.get("notes"),
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
        "schedule_id": actual_schedule_id,
        "patient_id": patient_id,
        "medicine_id": medicine_id,
        "medicine_name": medicine.get("name"),
        "warnings": warnings,
        "warning_count": len(warnings),
        "message": (
            "No medication safety conflicts detected."
            if safe
            else
            "Medication safety warnings require clinical review."
        ),
    }