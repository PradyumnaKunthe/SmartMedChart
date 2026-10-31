import re

# 1. Patch hospital.py
with open("backend/app/routes/hospital.py", "r", encoding="utf-8") as f:
    hosp_code = f.read()

# patient_to_dict
old_p2d = '''        "ward_id": patient.get("ward_id"),
        "bed_id": patient.get("bed_id"),
        "is_active": as_bool(patient.get("is_active")),
        "qr_is_active": as_bool(patient.get("qr_is_active")),'''

new_p2d = '''        "ward_id": patient.get("ward_id"),
        "bed_id": patient.get("bed_id"),
        "is_active": as_bool(patient.get("is_active")),
        "lifecycle_status": patient.get("lifecycle_status", "ACTIVE" if as_bool(patient.get("is_active")) else "DISCHARGED"),
        "qr_is_active": as_bool(patient.get("qr_is_active")),'''

assert old_p2d in hosp_code, "old_p2d not found in hospital.py"
hosp_code = hosp_code.replace(old_p2d, new_p2d, 1)

# get_hospital_dashboard
old_hosp_dash = '''@router.get("/dashboard")
def get_hospital_dashboard(
    current_user=Depends(require_permission("VIEW_PATIENT"))
):
    total = mongo_db.patients.count_documents({})

    active = mongo_db.patients.count_documents({
        "is_active": {"$in": [True, 1]}
    })

    return {
        "message": "Hospital dashboard generated successfully.",
        "hospital": {
            "portal": "Hospital Data Portal",
            "status": "ACTIVE",
        },
        "patients": {
            "total": total,
            "active": active,
            "inactive": total - active,
        },
    }'''

new_hosp_dash = '''@router.get("/dashboard")
def get_hospital_dashboard(
    current_user=Depends(require_permission("VIEW_PATIENT"))
):
    active_query = {
        "is_active": {"$in": [True, 1]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }
    active = mongo_db.patients.count_documents(active_query)

    return {
        "message": "Hospital dashboard generated successfully.",
        "hospital": {
            "portal": "Hospital Data Portal",
            "status": "ACTIVE",
        },
        "patients": {
            "total": active,
            "active": active,
            "inactive": 0,
        },
    }'''

assert old_hosp_dash in hosp_code, "old_hosp_dash not found in hospital.py"
hosp_code = hosp_code.replace(old_hosp_dash, new_hosp_dash, 1)

# get_hospital_patients
old_hosp_patients = '''@router.get("/patients")
def get_hospital_patients(
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    limit = max(1, min(limit, 500))

    query = {}

    if active_only:
        query["is_active"] = {"$in": [True, 1]}'''

new_hosp_patients = '''@router.get("/patients")
def get_hospital_patients(
    search: str | None = None,
    active_only: bool = True,
    limit: int = 100,
    current_user=Depends(require_permission("VIEW_PATIENT")),
):
    limit = max(1, min(limit, 500))

    query = {
        "is_active": {"$in": [True, 1]},
        "lifecycle_status": {"$ne": "DISCHARGED"},
    }'''

assert old_hosp_patients in hosp_code, "old_hosp_patients not found in hospital.py"
hosp_code = hosp_code.replace(old_hosp_patients, new_hosp_patients, 1)

with open("backend/app/routes/hospital.py", "w", encoding="utf-8") as f:
    f.write(hosp_code)
print("hospital.py patched successfully")

