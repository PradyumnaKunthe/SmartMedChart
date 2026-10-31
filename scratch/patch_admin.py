with open("backend/app/routes/admin.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. get_patients
old_get_patients = '''    patients = list(
        mongo_db.patients.find({
            "is_active": active_filter()
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )'''

new_get_patients = '''    patients = list(
        mongo_db.patients.find({
            "is_active": active_filter(),
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )'''

assert old_get_patients in code, "old_get_patients not found in admin.py"
code = code.replace(old_get_patients, new_get_patients, 1)

# 2. get_assignments
old_assign_check = '''        if nurse is None or patient is None:
            continue'''

new_assign_check = '''        if (
            nurse is None
            or patient is None
            or not mongo_bool(patient.get("is_active"))
            or patient.get("lifecycle_status") == "DISCHARGED"
        ):
            continue'''

assert old_assign_check in code, "old_assign_check not found in admin.py"
code = code.replace(old_assign_check, new_assign_check, 1)

# 3. get_patient_lifecycle & add @router.get("/patients/discharged")
old_lifecycle = '''@router.get("/patients/lifecycle")
def get_patient_lifecycle(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    active_patients = list(
        mongo_db.patients.find({
            "is_active": active_filter()
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )

    discharged_patients = list(
        mongo_db.patients.find({
            "is_active": {"$in": [False, 0]}
        }).sort("updated_at", -1)
    )

    def patient_summary(patient):
        billing = mongo_db.patient_billing.find_one({
            "patient_id": patient["id"]
        })

        active_encounter = mongo_db.encounters.find_one(
            {
                "patient_id": patient["id"],
                "status": "ACTIVE",
            },
            sort=[("created_at", -1)],
        )

        data = serialize_patient(patient)

        data.update({
            "billing": serialize_billing(billing),
            "active_encounter": serialize_encounter(
                active_encounter
            ),
        })

        return data

    return {
        "active": [
            patient_summary(patient)
            for patient in active_patients
        ],
        "discharged": [
            patient_summary(patient)
            for patient in discharged_patients
        ],
        "counts": {
            "active": len(active_patients),
            "discharged": len(discharged_patients),
        },
    }'''

new_lifecycle = '''@router.get("/patients/lifecycle")
def get_patient_lifecycle(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    active_patients = list(
        mongo_db.patients.find({
            "is_active": active_filter(),
            "lifecycle_status": {"$ne": "DISCHARGED"},
        }).sort([
            ("first_name", 1),
            ("last_name", 1),
        ])
    )

    discharged_patients = list(
        mongo_db.patients.find({
            "$or": [
                {"is_active": {"$in": [False, 0]}},
                {"lifecycle_status": "DISCHARGED"},
            ]
        }).sort("updated_at", -1)
    )

    def patient_summary(patient):
        billing = mongo_db.patient_billing.find_one({
            "patient_id": patient["id"]
        })

        active_encounter = mongo_db.encounters.find_one(
            {
                "patient_id": patient["id"],
                "status": "ACTIVE",
            },
            sort=[("created_at", -1)],
        )

        data = serialize_patient(patient)

        data.update({
            "billing": serialize_billing(billing),
            "active_encounter": serialize_encounter(
                active_encounter
            ),
        })

        return data

    return {
        "active": [
            patient_summary(patient)
            for patient in active_patients
        ],
        "discharged": [
            patient_summary(patient)
            for patient in discharged_patients
        ],
        "counts": {
            "active": len(active_patients),
            "discharged": len(discharged_patients),
        },
    }


@router.get("/patients/discharged")
def get_discharged_patients(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    require_admin_permission(current_user)

    discharged_patients = list(
        mongo_db.patients.find({
            "$or": [
                {"is_active": {"$in": [False, 0]}},
                {"lifecycle_status": "DISCHARGED"},
            ]
        }).sort("discharged_at", -1)
    )

    def patient_summary(patient):
        billing = mongo_db.patient_billing.find_one({
            "patient_id": patient["id"]
        })

        latest_encounter = mongo_db.encounters.find_one(
            {"patient_id": patient["id"]},
            sort=[("discharged_at", -1), ("created_at", -1)],
        )

        data = serialize_patient(patient)
        data.update({
            "billing": serialize_billing(billing),
            "encounter": serialize_encounter(latest_encounter),
            "discharged_at": patient.get("discharged_at"),
            "discharge_reason": patient.get("discharge_reason"),
        })
        return data

    return {
        "count": len(discharged_patients),
        "discharged": [
            patient_summary(patient)
            for patient in discharged_patients
        ],
    }'''

assert old_lifecycle in code, "old_lifecycle not found in admin.py"
code = code.replace(old_lifecycle, new_lifecycle, 1)

with open("backend/app/routes/admin.py", "w", encoding="utf-8") as f:
    f.write(code)
print("admin.py patched successfully")

