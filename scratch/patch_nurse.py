with open("backend/app/routes/nurse.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. _schedule_context
old_sched_ctx = '''def _schedule_context(schedule):
    item = _by_id(
        "prescription_items",
        schedule.get("prescription_item_id"),
    )
    if not item:
        return None

    prescription = _by_id(
        "prescriptions",
        item.get("prescription_id"),
    )
    if not prescription:
        return None

    patient = _by_id(
        "patients",
        prescription.get("patient_id"),
    )
    medicine = _by_id(
        "medicines",
        item.get("medicine_id"),
    )

    if patient is None or medicine is None:
        return None

    return item, prescription, patient, medicine'''

new_sched_ctx = '''def _schedule_context(schedule):
    if schedule.get("status") in ("CANCELLED", "DISCHARGED"):
        return None

    item = _by_id(
        "prescription_items",
        schedule.get("prescription_item_id"),
    )
    if not item or item.get("status") in ("CANCELLED", "DISCHARGED"):
        return None

    prescription = _by_id(
        "prescriptions",
        item.get("prescription_id"),
    )
    if not prescription or prescription.get("status") in ("CANCELLED", "DISCHARGED"):
        return None

    patient = _by_id(
        "patients",
        prescription.get("patient_id"),
    )
    medicine = _by_id(
        "medicines",
        item.get("medicine_id"),
    )

    if patient is None or medicine is None:
        return None

    if not (patient.get("is_active") in (True, 1)) or patient.get("lifecycle_status") == "DISCHARGED":
        return None

    return item, prescription, patient, medicine'''

assert old_sched_ctx in code, "old_sched_ctx not found in nurse.py"
code = code.replace(old_sched_ctx, new_sched_ctx, 1)

# 2. get_nurse_assigned_patients
old_assigned_pts = '''    patients = list(
        mongo_db.patients.find({
            "_id": {"$in": assigned_patient_ids},
            "is_active": {"$in": [1, True]},
        }).sort([("last_name", 1), ("first_name", 1)])
    )'''

new_assigned_pts = '''    patients = list(
        mongo_db.patients.find({
            "_id": {"$in": assigned_patient_ids},
            "is_active": {"$in": [1, True]},
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([("last_name", 1), ("first_name", 1)])
    )'''

assert old_assigned_pts in code, "old_assigned_pts not found in nurse.py"
code = code.replace(old_assigned_pts, new_assigned_pts, 1)

# 3. get_nurse_patient_details
old_patient_details = '''    p = mongo_db.patients.find_one({
        "$or": [{"_id": int(patient_id)}, {"id": int(patient_id)}],
        "is_active": {"$in": [1, True]},
    })'''

new_patient_details = '''    p = mongo_db.patients.find_one({
        "$or": [{"_id": int(patient_id)}, {"id": int(patient_id)}],
        "is_active": {"$in": [1, True]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    })'''

assert old_patient_details in code, "old_patient_details not found in nurse.py"
code = code.replace(old_patient_details, new_patient_details, 1)

with open("backend/app/routes/nurse.py", "w", encoding="utf-8") as f:
    f.write(code)
print("nurse.py patched successfully")

