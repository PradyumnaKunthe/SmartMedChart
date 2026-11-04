import os
import sys
from pathlib import Path
from types import SimpleNamespace
from fastapi import HTTPException
from pydantic import ValidationError

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from app.mongo_client import mongo_db
from app.routes import admin as admin_routes
from app.schemas.admin import StaffCreateRequest

def make_admin_user():
    admin_role = mongo_db.roles.find_one({"name": "Administrator"})
    assert admin_role, "Administrator role must exist in roles collection"
    role_id = admin_role.get("id", admin_role.get("_id", 4))

    admin_doc = mongo_db.users.find_one({
        "role_id": {"$in": [role_id, admin_role.get("_id"), 4]},
        "is_active": {"$in": [True, 1]}
    })
    assert admin_doc, "Admin user must exist in database"

    role_perms = list(mongo_db.role_permissions.find({"role_id": role_id}))
    perm_ids = [rp["permission_id"] for rp in role_perms]
    perms = list(mongo_db.permissions.find({"id": {"$in": perm_ids}}))
    if not perms:
        perms = list(mongo_db.permissions.find({}))

    role_obj = SimpleNamespace(
        id=role_id,
        name="Administrator",
        permissions=[SimpleNamespace(name=p["name"]) for p in perms],
    )

    return SimpleNamespace(
        id=admin_doc["id"],
        username=admin_doc["username"],
        full_name=admin_doc["full_name"],
        role=role_obj,
        is_active=True,
    )

def run_tests():
    print("=" * 80)
    print("SMARTMEDCHART TEST: STAFF REGISTRATION & DOCTOR/NURSE DASHBOARD")
    print("Connected Database:", mongo_db.name)
    print("=" * 80)

    admin_user = make_admin_user()
    print(f"Logged in as Administrator: @{admin_user.username} (ID: {admin_user.id})")

    # 1. Verify Doctor & Nurse roles
    doctor_role = mongo_db.roles.find_one({"name": "Doctor"})
    nurse_role = mongo_db.roles.find_one({"name": "Nurse"})
    assert doctor_role, "Doctor role must exist in roles collection"
    assert doctor_role["_id"] == 1 and doctor_role["id"] == 1, f"Doctor role must have _id=1 and id=1, found {doctor_role}"
    assert nurse_role, "Nurse role must exist in roles collection"
    assert nurse_role["_id"] == 2 and nurse_role["id"] == 2, f"Nurse role must have _id=2 and id=2, found {nurse_role}"
    print("[PASS] Requirement 5: Roles verified in MongoDB. Doctor role_id=1, Nurse role_id=2.")

    # Clean any previous test accounts
    test_doctor_username = "dr_rajesh_sharma"
    test_doctor_email = "dr.rajesh.sharma@hospital.org"
    test_nurse_username = "nurse_priya_patel"
    test_nurse_email = "nurse.priya.patel@hospital.org"
    mongo_db.users.delete_many({"username": {"$in": [test_doctor_username, test_nurse_username]}})
    mongo_db.users.delete_many({"email": {"$in": [test_doctor_email, test_nurse_email]}})

    # TEST CASE 1 & 2: Create a Doctor account with valid payload
    print("\n--- TEST CASE 1 & 2: Create Doctor Account ---")
    doc_req = StaffCreateRequest(
        full_name="Dr. Rajesh Sharma",
        username=test_doctor_username,
        email=test_doctor_email,
        password="DoctorSecure2026!",
        role="doctor"
    )
    doc_res = admin_routes.create_staff(request=doc_req, current_user=admin_user)
    print("Response:", doc_res)
    assert "Doctor account created successfully" in doc_res.get("message", "")
    assert doc_res["staff"]["username"] == test_doctor_username
    assert doc_res["staff"]["role"] == "Doctor"
    print("[PASS] Requirement 1 & 2: Doctor created with single payload. Success message returned.")

    # TEST CASE 4: Verify Doctor in MongoDB users
    print("\n--- TEST CASE 4: Verify Doctor in MongoDB users ---")
    doc_db = mongo_db.users.find_one({"username": test_doctor_username})
    assert doc_db is not None, "Doctor not found in MongoDB users!"
    assert doc_db["role_id"] == 1, f"Doctor role_id must be 1, got {doc_db['role_id']}"
    assert doc_db["is_active"] in [True, 1], f"Doctor is_active must be True/1, got {doc_db['is_active']}"
    assert doc_db["full_name"] == "Dr. Rajesh Sharma"
    print(f"[PASS] Requirement 4: Doctor found in MongoDB users (id: {doc_db['id']}, role_id: {doc_db['role_id']}, is_active: {doc_db['is_active']}).")

    # TEST CASE 5: Confirm Doctor appears in /api/admin/doctors
    print("\n--- TEST CASE 5: Verify Doctor in /api/admin/doctors ---")
    doc_list_res = admin_routes.get_doctors(current_user=admin_user)
    doctors_list = doc_list_res.get("doctors", [])
    matching_docs = [d for d in doctors_list if d.get("username") == test_doctor_username]
    assert len(matching_docs) == 1, f"Doctor {test_doctor_username} not found in /api/admin/doctors: {doctors_list}"
    assert matching_docs[0]["full_name"] == "Dr. Rajesh Sharma"
    assert matching_docs[0]["role"] == "Doctor"
    print(f"[PASS] Requirement 5: Doctor found in /api/admin/doctors (Total doctors: {len(doctors_list)}).")

    # TEST CASE 6: Confirm Doctor appears in /api/admin/workload/doctors
    print("\n--- TEST CASE 6: Verify Doctor in /api/admin/workload/doctors ---")
    workload_res = admin_routes.get_doctor_workload(current_user=admin_user)
    workload_docs = workload_res.get("doctors", [])
    matching_workload_docs = [d for d in workload_docs if d.get("username") == test_doctor_username]
    assert len(matching_workload_docs) == 1, f"Doctor {test_doctor_username} not found in workload: {workload_docs}"
    assert matching_workload_docs[0]["patient_count"] == 0, "New doctor with 0 encounters should have patient_count=0"
    print(f"[PASS] Requirement 6: Doctor found in /api/admin/workload/doctors with patient_count=0 (Total workload doctors: {len(workload_docs)}).")

    # TEST CASE 7: Create a Nurse account and verify endpoints
    print("\n--- TEST CASE 7: Create Nurse Account & Verify Endpoints ---")
    nurse_req = StaffCreateRequest(
        full_name="Nurse Priya Patel",
        username=test_nurse_username,
        email=test_nurse_email,
        password="NurseSecure2026!",
        role="nurse"
    )
    nurse_res = admin_routes.create_staff(request=nurse_req, current_user=admin_user)
    assert "Nurse account created successfully" in nurse_res.get("message", "")

    nurse_db = mongo_db.users.find_one({"username": test_nurse_username})
    assert nurse_db is not None, "Nurse not found in MongoDB users!"
    assert nurse_db["role_id"] == 2, f"Nurse role_id must be 2, got {nurse_db['role_id']}"
    assert nurse_db["is_active"] in [True, 1]

    nurse_list_res = admin_routes.get_nurses(current_user=admin_user)
    nurses_list = nurse_list_res.get("nurses", [])
    matching_nurses = [n for n in nurses_list if n.get("username") == test_nurse_username]
    assert len(matching_nurses) == 1, f"Nurse not found in /api/admin/nurses: {nurses_list}"
    assert matching_nurses[0]["role"] == "Nurse"

    nurse_workload_res = admin_routes.get_nurse_workload(current_user=admin_user)
    workload_nurses = nurse_workload_res.get("nurses", [])
    matching_workload_nurses = [n for n in workload_nurses if n.get("username") == test_nurse_username]
    assert len(matching_workload_nurses) == 1
    assert matching_workload_nurses[0]["patient_count"] == 0
    print(f"[PASS] Requirement 7: Nurse created, found in DB, /api/admin/nurses ({len(nurses_list)}), and /api/admin/workload/nurses ({len(workload_nurses)}).")

    # TEST CASE 8: Test duplicate username and email handling
    print("\n--- TEST CASE 8: Duplicate Username and Email Handling ---")
    dup_user_req = StaffCreateRequest(
        full_name="Another Doctor",
        username=test_doctor_username,
        email="different.email@hospital.org",
        password="DoctorSecure2026!",
        role="doctor"
    )
    try:
        admin_routes.create_staff(request=dup_user_req, current_user=admin_user)
        assert False, "Should have raised 409 for duplicate username"
    except HTTPException as e:
        assert e.status_code == 409, f"Expected 409, got {e.status_code}"
        assert "Username already exists" in e.detail
        print("[PASS] Requirement 8a: Duplicate username correctly rejected with 409 'Username already exists.'.")

    dup_email_req = StaffCreateRequest(
        full_name="Another Doctor",
        username="brand_new_username",
        email=test_doctor_email,
        password="DoctorSecure2026!",
        role="doctor"
    )
    try:
        admin_routes.create_staff(request=dup_email_req, current_user=admin_user)
        assert False, "Should have raised 409 for duplicate email"
    except HTTPException as e:
        assert e.status_code == 409, f"Expected 409, got {e.status_code}"
        assert "Email already exists" in e.detail
        print("[PASS] Requirement 8b: Duplicate email correctly rejected with 409 'Email already exists.'.")

    # TEST CASE 9: Test invalid password validation (< 8 chars)
    print("\n--- TEST CASE 9: Invalid Password Validation (< 8 chars) ---")
    try:
        StaffCreateRequest(
            full_name="Short Password Staff",
            username="short_pw_user",
            email="short.pw@hospital.org",
            password="12345",  # 5 chars (< 8)
            role="doctor"
        )
        assert False, "Pydantic should have rejected password with < 8 chars"
    except ValidationError as e:
        errors = e.errors()
        assert any("at least 8" in str(err) or "min_length" in str(err) for err in errors)
        print(f"[PASS] Requirement 9: Invalid password rejected by schema with validation error: {errors[0]['msg']}.")

    # TEST CASE 10: Staff listing verification
    print("\n--- TEST CASE 10: Staff Listing & Dashboard Counts ---")
    staff_res = admin_routes.get_staff(current_user=admin_user)
    all_staff = staff_res.get("staff", [])
    staff_usernames = [s.get("username") for s in all_staff]
    assert test_doctor_username in staff_usernames, f"{test_doctor_username} not found in staff roster"
    assert test_nurse_username in staff_usernames, f"{test_nurse_username} not found in staff roster"
    print(f"[PASS] Requirement 10: All active staff properly listed in /api/admin/staff (Total staff: {len(all_staff)}).")

    print("\n" + "=" * 80)
    print("ALL 10 REQUIREMENTS AND TEST CASES PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
