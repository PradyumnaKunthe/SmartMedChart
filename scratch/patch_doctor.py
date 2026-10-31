with open("backend/app/routes/doctor.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. get_doctor_patient_or_404
old_doctor_patient = '''def get_doctor_patient_or_404(patient_id: int, current_user):
    """
    Return only an active patient assigned to the
    currently logged-in doctor through an active encounter.
    """

    patient = mongo_db.patients.find_one({
        "_id": patient_id,
        "is_active": active_filter(),
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    encounter = mongo_db.encounters.find_one({
        "patient_id": patient_id,
        "doctor_id": current_user.id,
        "status": "ACTIVE",
    })

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail="Patient is not assigned to this doctor.",
        )

    return patient'''

new_doctor_patient = '''def get_doctor_patient_or_404(patient_id: int, current_user):
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

    return patient'''

assert old_doctor_patient in code, "old_doctor_patient not found in doctor.py"
code = code.replace(old_doctor_patient, new_doctor_patient, 1)

# 2. search_patients
old_search_query = '''    query = {
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
    }'''

new_search_query = '''    query = {
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }'''

assert old_search_query in code, "old_search_query not found in doctor.py"
code = code.replace(old_search_query, new_search_query, 1)

# 3. get_doctor_round_patients
old_rounds_query = '''    patients = list(mongo_db.patients.find({
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
    }).sort([("last_name", 1), ("first_name", 1)]))'''

new_rounds_query = '''    patients = list(mongo_db.patients.find({
        "_id": {"$in": patient_ids},
        "is_active": active_filter(),
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }).sort([("last_name", 1), ("first_name", 1)]))'''

assert old_rounds_query in code, "old_rounds_query not found in doctor.py"
code = code.replace(old_rounds_query, new_rounds_query, 1)

with open("backend/app/routes/doctor.py", "w", encoding="utf-8") as f:
    f.write(code)
print("doctor.py patched successfully")

