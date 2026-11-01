import os
import sys
from pathlib import Path
from datetime import datetime, date, time, timezone
from types import SimpleNamespace
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

# Explicitly ensure isolated test database is targeted
os.environ["MONGODB_DATABASE"] = "smartmedchart_e2e_test"

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes import doctor as doctor_routes
from app.routes import admin as admin_routes
from app.routes import hospital as hospital_routes
from app.security import (
    create_access_token,
    decode_access_token,
    get_current_user,
)
from app.schemas.prescription import PrescriptionCreate, PrescriptionItemCreate


def make_user(role_name: str, user_id: int, username: str, permission_names: list[str]):
    perms = [SimpleNamespace(name=p) for p in permission_names]
    role = SimpleNamespace(
        id=1 if role_name == "Doctor" else (2 if role_name == "Nurse" else (3 if role_name == "Receptionist" else 4)),
        name=role_name,
        permissions=perms,
    )
    return SimpleNamespace(id=user_id, username=username, full_name=f"{username.capitalize()}", role=role)


def run_tests():
    print("=" * 80)
    print("SMARTMEDCHART E2E TEST: BED ASSIGNMENT AUTHENTICATION & AVAILABLE BED LOADING")
    print("Target Database:", mongo_db.name)
    print("=" * 80)

    assert mongo_db.name == "smartmedchart_e2e_test", "CRITICAL SAFETY HALT: Must run on smartmedchart_e2e_test only!"

    # 1. Setup Test Actors (Doctor, Admin, Receptionist)
    db_doctor = mongo_db.users.find_one({"role_id": 1}) or mongo_db.users.find_one({"username": {"$regex": "doc", "$options": "i"}})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})
    db_receptionist = mongo_db.users.find_one({"role_id": 3}) or mongo_db.users.find_one({"username": {"$regex": "recep", "$options": "i"}})

    assert db_doctor, "Doctor user must exist in test DB"
    assert db_admin, "Admin user must exist in test DB"

    doctor_id = db_doctor["id"]
    doctor_username = db_doctor["username"]

    doctor_user = make_user("Doctor", doctor_id, doctor_username, [
        "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "VIEW_MEDICATION_SCHEDULE"
    ])
    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], [
        "MANAGE_SYSTEM", "MANAGE_USERS", "VIEW_PATIENT", "EDIT_PATIENT", "MANAGE_INVENTORY"
    ])
    receptionist_user = make_user("Receptionist", db_receptionist["id"] if db_receptionist else 301, "receptionist", [
        "VIEW_PATIENT", "REGISTER_PATIENT"
    ])

    print(f"[AUTH] Doctor: {doctor_user.username} (ID: {doctor_user.id})")

    # =========================================================================
    # SCENARIO 1: JWT Authentication & Claims Validation
    # =========================================================================
    print("\n--- SCENARIO 1: Doctor Login & JWT Token Validation ---")
    valid_token = create_access_token(subject=str(doctor_id), expires_minutes=30)
    assert valid_token is not None and len(valid_token) > 20
    decoded = decode_access_token(valid_token)
    assert decoded["sub"] == str(doctor_id)
    assert "exp" in decoded and "iat" in decoded
    assert decoded["exp"] > decoded["iat"]

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
    authenticated_doctor = get_current_user(creds)
    assert authenticated_doctor.id == doctor_id
    assert authenticated_doctor.role.name == "Doctor"
    perms = [p.name for p in authenticated_doctor.role.permissions]
    assert "VIEW_PATIENT" in perms
    print(f"PASS: Doctor JWT verified (ID: {doctor_id}, Role: {authenticated_doctor.role.name}, Permissions: {perms})")

    # =========================================================================
    # SCENARIO 2: Synthetic Active Patient Setup
    # =========================================================================
    print("\n--- SCENARIO 2: Synthetic Active Patient Setup ---")
    # Clean old test patient if left over
    mongo_db.patients.delete_many({"first_name": "E2E_BED_AUTH_PATIENT"})
    mongo_db.encounters.delete_many({"chief_complaint": "E2E Bed Auth Test Active Patient"})

    now = datetime.now(timezone.utc).isoformat()
    test_patient_id = 88001
    mongo_db.patients.insert_one({
        "_id": test_patient_id,
        "id": test_patient_id,
        "patient_id": "PAT-88001",
        "first_name": "E2E_BED_AUTH_PATIENT",
        "last_name": "ONE",
        "full_name": "E2E_BED_AUTH_PATIENT ONE",
        "gender": "MALE",
        "age": 45,
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "is_admitted": False,
        "ward_id": None,
        "bed_id": None,
        "created_at": now,
        "updated_at": now,
    })
    test_encounter_id = 88101
    mongo_db.encounters.insert_one({
        "_id": test_encounter_id,
        "id": test_encounter_id,
        "patient_id": test_patient_id,
        "doctor_id": doctor_id,
        "status": "ACTIVE",
        "encounter_type": "OPD",
        "chief_complaint": "E2E Bed Auth Test Active Patient",
        "created_at": now,
        "updated_at": now,
    })
    print(f"PASS: Synthetic patient #{test_patient_id} established and linked to Doctor #{doctor_id}.")

    # =========================================================================
    # SCENARIO 3 & 4: Ward Listing Endpoint
    # =========================================================================
    print("\n--- SCENARIO 3 & 4: Ward Listing (GET /api/doctor/wards) ---")
    wards_res = doctor_routes.get_doctor_wards(current_user=authenticated_doctor)
    assert "wards" in wards_res and wards_res["count"] > 0
    print(f"PASS: Doctor retrieved {wards_res['count']} wards dynamically:")
    for w in wards_res["wards"]:
        print(f"  - Ward #{w['id']}: {w['name']} ({w['code']}) — {w['available_beds']} Available / {w['total_beds']} Total")

    # =========================================================================
    # SCENARIO 5, 6, 7: ICU Ward (IC-01) Verification & Available Beds Loading
    # =========================================================================
    print("\n--- SCENARIO 5, 6, 7: ICU Ward (ID: 2) Beds Fetching from MongoDB ---")
    icu_ward = mongo_db.wards.find_one({"$or": [{"_id": 2}, {"id": 2}]})
    assert icu_ward is not None, "ICU Ward (ID 2) must exist in test database"

    # Ensure ICU beds (9, 10, 11, 12) exist and reset states to 3 available, 1 occupied
    for b_id, b_num in [(9, "IC-1"), (10, "IC-2"), (11, "IC-3"), (12, "IC-4")]:
        mongo_db.beds.update_one(
            {"_id": b_id},
            {"$set": {
                "_id": b_id,
                "id": b_id,
                "ward_id": 2,
                "bed_number": b_num,
                "is_active": True,
                "is_occupied": 1 if b_id == 11 else 0,
                "occupied_by_patient_id": 7002 if b_id == 11 else None,
            }},
            upsert=True,
        )

    # Verify MongoDB actual documents
    icu_db_beds = list(mongo_db.beds.find({"ward_id": 2, "is_active": {"$in": [True, 1]}}))
    assert len(icu_db_beds) == 4, f"Expected 4 ICU beds, found {len(icu_db_beds)}"
    avail_db_beds = [b for b in icu_db_beds if not (b.get("is_occupied") in (True, 1))]
    assert len(avail_db_beds) == 3, f"Expected 3 unoccupied beds in ICU, found {len(avail_db_beds)}"
    print(f"PASS: Verified in MongoDB -> ICU Ward has {len(icu_db_beds)} total beds, {len(avail_db_beds)} unoccupied.")

    # Call doctor beds endpoint
    icu_beds_res = doctor_routes.get_doctor_ward_beds(
        ward_id=2, patient_id=test_patient_id, current_user=authenticated_doctor
    )
    assert "beds" in icu_beds_res
    returned_beds = icu_beds_res["beds"]
    assert len(returned_beds) == 4

    # Verify bed availability flags
    b9 = next(b for b in returned_beds if b["id"] == 9)
    b10 = next(b for b in returned_beds if b["id"] == 10)
    b11 = next(b for b in returned_beds if b["id"] == 11)
    b12 = next(b for b in returned_beds if b["id"] == 12)

    assert b9["is_available"] is True and b9["status"] == "AVAILABLE"
    assert b10["is_available"] is True and b10["status"] == "AVAILABLE"
    assert b11["is_available"] is False and b11["status"] == "OCCUPIED"
    assert b12["is_available"] is True and b12["status"] == "AVAILABLE"
    print(f"PASS: Endpoint returned 4 ICU beds: Bed 9, 10, 12 AVAILABLE; Bed 11 OCCUPIED.")

    # =========================================================================
    # SCENARIO 8, 9, 10: Select Available Bed & Submit Prescription Admission
    # =========================================================================
    print("\n--- SCENARIO 8, 9, 10: Authorize Prescription with ICU Bed #9 Allocation ---")
    med = mongo_db.medicines.find_one({"is_active": {"$in": [True, 1]}, "is_archived": {"$ne": True}})
    if not med:
        mongo_db.medicines.insert_one({
            "_id": 9901, "id": 9901, "name": "MEROPENEM 1G INJ",
            "dosage_form": "INJECTION", "strength": "1g", "is_active": True, "total_stock": 100
        })
        med = mongo_db.medicines.find_one({"_id": 9901})
    test_med_id = med["id"]

    rx_req = PrescriptionCreate(
        patient_id=test_patient_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="TID",
                duration_days=5,
                start_date=date.today(),
                start_time=time(8, 0, 0),
                instructions="Infuse in 100ml NS over 30 mins",
            )
        ],
        notes="Admitted to ICU for septic shock management and respiratory monitoring",
        admit_patient=True,
        ward_id=2,
        bed_id=9,
    )
    rx_res = doctor_routes.create_prescription(rx_req, current_user=authenticated_doctor)
    assert rx_res["bed_assignment"] is not None
    assert rx_res["bed_assignment"]["ward_id"] == 2
    assert rx_res["bed_assignment"]["bed_id"] == 9
    print(f"PASS: Prescription authorized: {rx_res['bed_assignment']}")

    # Verify MongoDB updates
    db_bed9 = mongo_db.beds.find_one({"_id": 9})
    assert db_bed9["is_occupied"] in (1, True)
    assert db_bed9["occupied_by_patient_id"] == test_patient_id

    db_pat = mongo_db.patients.find_one({"_id": test_patient_id})
    assert db_pat["is_admitted"] is True
    assert db_pat["ward_id"] == 2
    assert db_pat["bed_id"] == 9

    db_enc = mongo_db.encounters.find_one({"_id": test_encounter_id})
    assert db_enc["encounter_type"] == "INPATIENT"
    assert db_enc["ward_id"] == 2
    assert db_enc["bed_id"] == 9
    print("PASS: MongoDB Bed #9, Patient #88001, and Encounter #88101 synchronized to INPATIENT.")

    # =========================================================================
    # SCENARIO 11: Double Allocation Prevention (HTTP 409 Conflict)
    # =========================================================================
    print("\n--- SCENARIO 11: Double Allocation Prevention (HTTP 409) ---")
    # Setup second patient
    test_patient2_id = 88002
    mongo_db.patients.delete_many({"_id": test_patient2_id})
    mongo_db.encounters.delete_many({"patient_id": test_patient2_id})
    mongo_db.patients.insert_one({
        "_id": test_patient2_id,
        "id": test_patient2_id,
        "patient_id": "PAT-88002",
        "first_name": "E2E_BED_AUTH_PATIENT",
        "last_name": "TWO",
        "full_name": "E2E_BED_AUTH_PATIENT TWO",
        "gender": "FEMALE",
        "age": 50,
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "is_admitted": False,
        "ward_id": None,
        "bed_id": None,
        "created_at": now,
        "updated_at": now,
    })
    mongo_db.encounters.insert_one({
        "_id": 88102,
        "id": 88102,
        "patient_id": test_patient2_id,
        "doctor_id": doctor_id,
        "status": "ACTIVE",
        "encounter_type": "OPD",
        "created_at": now,
        "updated_at": now,
    })

    rx_dup = PrescriptionCreate(
        patient_id=test_patient2_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="ONCE_DAILY",
                duration_days=2,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=2,
        bed_id=9,  # Already occupied by patient 1!
    )
    try:
        doctor_routes.create_prescription(rx_dup, current_user=authenticated_doctor)
        assert False, "Double bed allocation must raise HTTP 409 Conflict"
    except HTTPException as exc:
        assert exc.status_code == 409
        assert "already occupied" in exc.detail.lower()
        print(f"PASS: Double allocation blocked with HTTP 409: '{exc.detail}'")

    # =========================================================================
    # SCENARIO 12: Expired and Invalid Token Rejection
    # =========================================================================
    print("\n--- SCENARIO 12: Expired and Invalid Token Rejection (HTTP 401) ---")
    expired_token = create_access_token(subject=str(doctor_id), expires_minutes=-5)
    exp_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    try:
        get_current_user(exp_creds)
        assert False, "Expired token must raise HTTP 401"
    except HTTPException as exc:
        assert exc.status_code == 401
        assert "Invalid or expired access token." in exc.detail
        print(f"PASS: Expired token rejected with HTTP 401: '{exc.detail}'")

    tampered_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature")
    try:
        get_current_user(tampered_creds)
        assert False, "Tampered token must raise HTTP 401"
    except HTTPException as exc:
        assert exc.status_code == 401
        assert "Invalid or expired access token." in exc.detail
        print(f"PASS: Tampered token rejected with HTTP 401: '{exc.detail}'")

    # =========================================================================
    # SCENARIO 13: Valid Session Continuation
    # =========================================================================
    print("\n--- SCENARIO 13: Valid Session Continuation ---")
    valid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
    active_user = get_current_user(valid_creds)
    assert active_user.id == doctor_id
    print(f"PASS: Valid token continues to authenticate doctor #{active_user.id} without error.")

    # =========================================================================
    # SCENARIO 14 & 15: Ward Change & Reassignment
    # =========================================================================
    print("\n--- SCENARIO 14 & 15: Ward Change & Bed Transfer ---")
    # Patient 1 transferred from Bed 9 to Bed 10 in ICU Ward
    # Use distinct medicine to avoid duplicate prescription block
    med2 = mongo_db.medicines.find_one({"_id": {"$ne": test_med_id}, "is_active": {"$in": [True, 1]}})
    if not med2:
        mongo_db.medicines.insert_one({
            "_id": 9902, "id": 9902, "name": "LEVETIRACETAM 500MG TAB",
            "dosage_form": "TABLET", "strength": "500mg", "is_active": True, "total_stock": 100
        })
        med2 = mongo_db.medicines.find_one({"_id": 9902})
    test_med2_id = med2["id"]

    rx_transfer = PrescriptionCreate(
        patient_id=test_patient_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med2_id,
                dose="500mg",
                route="Oral",
                frequency="TWICE_DAILY",
                duration_days=3,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=2,
        bed_id=10,  # Move to Bed 10
    )
    rx_trans_res = doctor_routes.create_prescription(rx_transfer, current_user=authenticated_doctor)
    assert rx_trans_res["bed_assignment"]["bed_id"] == 10

    # Old Bed 9 must be released
    b9_freed = mongo_db.beds.find_one({"_id": 9})
    assert b9_freed["is_occupied"] in (0, False)
    assert b9_freed["occupied_by_patient_id"] is None

    # New Bed 10 must be occupied by patient 1
    b10_occ = mongo_db.beds.find_one({"_id": 10})
    assert b10_occ["is_occupied"] in (1, True)
    assert b10_occ["occupied_by_patient_id"] == test_patient_id
    print("PASS: Patient transferred to Bed 10. Old Bed 9 automatically released and now unoccupied.")

    # =========================================================================
    # SCENARIO 16: Discharge Releases Bed
    # =========================================================================
    print("\n--- SCENARIO 16: Patient Discharge Releases Bed ---")
    mongo_db.patient_billing.update_one(
        {"patient_id": test_patient_id},
        {"$set": {"bill_status": "PAID"}},
        upsert=True,
    )
    disc_res = admin_routes.discharge_patient(
        patient_id=test_patient_id,
        request={"discharge_reason": "Transferred out / discharged home"},
        current_user=admin_user,
    )
    print("Discharge message:", disc_res["message"])

    # Bed 10 must now be released
    b10_released = mongo_db.beds.find_one({"_id": 10})
    assert b10_released["is_occupied"] in (0, False)
    assert b10_released["occupied_by_patient_id"] is None

    # Patient record marked DISCHARGED
    pat_disc = mongo_db.patients.find_one({"_id": test_patient_id})
    assert pat_disc["lifecycle_status"] == "DISCHARGED"
    assert pat_disc["is_active"] in (False, 0)
    assert pat_disc["bed_id"] is None
    assert pat_disc["ward_id"] is None
    print("PASS: Bed 10 released upon discharge. Patient lifecycle status: DISCHARGED.")

    # =========================================================================
    # SCENARIO 17: Receptionist Counter Still Has No Bed Controls
    # =========================================================================
    print("\n--- SCENARIO 17: Receptionist Counter Verification ---")
    pat_payload = {
        "full_name": "E2E_BED_AUTH_PATIENT RECEPTIONIST_INTAKE",
        "age": 28,
        "gender": "MALE",
        "mobile_number": "9123456789",
        "problem_category": "GENERAL MEDICINE",
        "chief_complaint": "MILD COUGH AND COLD",
        "doctor_id": doctor_id,
        "is_admitted": False,
        "ward_id": None,
        "bed_id": None,
    }
    reg_res = hospital_routes.create_hospital_patient(pat_payload, current_user=receptionist_user)
    rec_pat_id = reg_res["patient"]["id"]
    rec_pat = mongo_db.patients.find_one({"_id": rec_pat_id})
    assert rec_pat.get("is_admitted") in (False, None, 0)
    assert rec_pat.get("ward_id") is None
    assert rec_pat.get("bed_id") is None
    print(f"PASS: Receptionist patient #{rec_pat_id} registered as OPD with NO bed allocation.")

    # Clean up test patients
    mongo_db.patient_billing.update_one(
        {"patient_id": test_patient2_id},
        {"$set": {"bill_status": "PAID"}},
        upsert=True,
    )
    admin_routes.discharge_patient(
        patient_id=test_patient2_id,
        request={"discharge_reason": "Test teardown"},
        current_user=admin_user,
    )
    mongo_db.patients.delete_many({"_id": {"$in": [test_patient_id, test_patient2_id, rec_pat_id]}})
    mongo_db.encounters.delete_many({"patient_id": {"$in": [test_patient_id, test_patient2_id, rec_pat_id]}})
    print("Cleaned up synthetic test records.")

    print("\n" + "=" * 80)
    print("ALL 17 SCENARIOS PASSED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
