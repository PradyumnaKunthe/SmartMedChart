with open("backend/app/routes/doctor.py", "r", encoding="utf-8") as f:
    code = f.read()

# Replace get_doctor_patient_or_404 and get_doctor_patient_history_or_404
old_helpers = '''def get_doctor_patient_or_404(patient_id: int, current_user):
    """
    Return only an active patient assigned to the
    currently logged-in doctor through an active encounter.
    """
    patient = mongo_db.patients.find_one({
        "$or": [{"_id": patient_id}, {"id": patient_id}],
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not mongo_bool(patient.get("is_active")) or patient.get("lifecycle_status") == "DISCHARGED":
        raise HTTPException(
            status_code=400,
            detail="Cannot create prescription for a discharged patient.",
        )

    actual_id = int(patient.get("id", patient.get("_id")))

    encounter = mongo_db.encounters.find_one({
        "patient_id": actual_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=403,
            detail="Patient is not assigned to this doctor.",
        )

    return patient


def get_doctor_patient_history_or_404(patient_id: int, current_user):
    """
    Verify that the patient exists and has at least one clinical
    encounter linked to the logged-in doctor (active or discharged).
    """
    patient = mongo_db.patients.find_one({
        "$or": [{"_id": patient_id}, {"id": patient_id}],
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    encounter = mongo_db.encounters.find_one({
        "patient_id": patient_id,
        "doctor_id": current_user.id,
    })

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    return patient'''

new_helpers = '''def get_doctor_patient_or_404(patient_id: Any, current_user):
    """
    Return only an active patient assigned to the
    currently logged-in doctor through an active encounter.
    """
    queries = [{"patient_id": str(patient_id).strip()}]
    try:
        numeric_id = int(patient_id)
        queries.extend([{"_id": numeric_id}, {"id": numeric_id}])
    except (ValueError, TypeError):
        pass

    patient = mongo_db.patients.find_one({"$or": queries})

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    if not mongo_bool(patient.get("is_active")) or patient.get("lifecycle_status") == "DISCHARGED":
        raise HTTPException(
            status_code=400,
            detail="Cannot create prescription for a discharged patient.",
        )

    actual_id = int(patient.get("id", patient.get("_id")))

    encounter = mongo_db.encounters.find_one({
        "patient_id": actual_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=403,
            detail="Patient is not assigned to this doctor.",
        )

    return patient


def get_doctor_patient_history_or_404(patient_id: Any, current_user):
    """
    Verify that the patient exists and has at least one clinical
    encounter linked to the logged-in doctor (active or discharged).
    """
    queries = [{"patient_id": str(patient_id).strip()}]
    try:
        numeric_id = int(patient_id)
        queries.extend([{"_id": numeric_id}, {"id": numeric_id}])
    except (ValueError, TypeError):
        pass

    patient = mongo_db.patients.find_one({"$or": queries})

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    actual_id = int(patient.get("id", patient.get("_id")))

    encounter = mongo_db.encounters.find_one({
        "patient_id": actual_id,
        "doctor_id": current_user.id,
    })

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    return patient'''

assert old_helpers in code, "old_helpers not found"
code = code.replace(old_helpers, new_helpers, 1)

# Route signatures patient_id: int -> patient_id: str
code = code.replace("def get_patient(\n    patient_id: int,", "def get_patient(\n    patient_id: str,")
code = code.replace("def get_patient_allergies(\n    patient_id: int,", "def get_patient_allergies(\n    patient_id: str,")
code = code.replace("def get_current_medications(\n    patient_id: int,", "def get_current_medications(\n    patient_id: str,")
code = code.replace("def get_prescription_history(\n    patient_id: int,", "def get_prescription_history(\n    patient_id: str,")

with open("backend/app/routes/doctor.py", "w", encoding="utf-8") as f:
    f.write(code)
print("backend/app/routes/doctor.py updated successfully")

