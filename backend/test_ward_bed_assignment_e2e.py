import os
import sys
from pathlib import Path
from datetime import datetime, date, time, timezone
from types import SimpleNamespace
from fastapi import HTTPException

# Explicitly ensure isolated test database is targeted
os.environ["MONGODB_DATABASE"] = "smartmedchart_e2e_test"

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes import doctor as doctor_routes
from app.routes import admin as admin_routes
from app.routes import hospital as hospital_routes
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
    print("SMARTMEDCHART E2E TEST SUITE: WARD & BED ASSIGNMENT WORKFLOW")
    print("Target Database:", mongo_db.name)
    print("=" * 80)

    # Safety Guard: MUST be isolated test database
    assert mongo_db.name == "smartmedchart_e2e_test", "CRITICAL SAFETY HALT: Must run on smartmedchart_e2e_test only!"

    # 1. Setup Test Actors (Doctor, Admin, Receptionist)
    db_doctor = mongo_db.users.find_one({"role_id": 1}) or mongo_db.users.find_one({"username": {"$regex": "doc", "$options": "i"}})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})
    db_receptionist = mongo_db.users.find_one({"role_id": 3}) or mongo_db.users.find_one({"username": {"$regex": "recep", "$options": "i"}})

    assert db_doctor, "Doctor user must exist in test DB"
    assert db_admin, "Admin user must exist in test DB"

    doctor_user = make_user("Doctor", db_doctor["id"], db_doctor["username"], [
        "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "VIEW_MEDICATION_SCHEDULE"
    ])
    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], [
        "MANAGE_SYSTEM", "MANAGE_USERS", "VIEW_PATIENT", "EDIT_PATIENT", "MANAGE_INVENTORY"
    ])
    receptionist_user = make_user("Receptionist", db_receptionist["id"] if db_receptionist else 301, "receptionist", [
        "VIEW_PATIENT", "REGISTER_PATIENT"
    ])

    print(f"[AUTH] Doctor: {doctor_user.username} (ID: {doctor_user.id})")
    print(f"[AUTH] Admin: {admin_user.username} (ID: {admin_user.id})")
    print(f"[AUTH] Receptionist: {receptionist_user.username} (ID: {receptionist_user.id})")

    # Ensure active wards and beds exist in test DB
    wards_count = mongo_db.wards.count_documents({"is_active": {"$in": [True, 1]}})
    if wards_count == 0:
        mongo_db.wards.insert_one({
            "_id": 1, "id": 1, "name": "General Medical Ward", "code": "GMW-01", "is_active": True
        })
    test_ward = mongo_db.wards.find_one({"is_active": {"$in": [True, 1]}})
    ward_id = test_ward["id"]
    print(f"\n[SETUP] Using Active Ward ID: {ward_id} ({test_ward['name']})")

    # Ensure at least 2 beds exist for this ward
    for b_num, b_id in [(101, 1), (102, 2)]:
        if not mongo_db.beds.find_one({"_id": b_id}):
            mongo_db.beds.insert_one({
                "_id": b_id,
                "id": b_id,
                "ward_id": ward_id,
                "bed_number": str(b_num),
                "is_active": True,
                "is_occupied": 0,
                "occupied_by_patient_id": None,
            })
    # Reset beds 1 and 2 to unoccupied for clean test baseline
    mongo_db.beds.update_many(
        {"_id": {"$in": [1, 2]}},
        {"$set": {"is_occupied": 0, "occupied_by_patient_id": None}}
    )

    # Ensure a formulary medicine exists
    med = mongo_db.medicines.find_one({"is_active": {"$in": [True, 1]}, "is_archived": {"$ne": True}})
    if not med:
        med_id = 9101
        mongo_db.medicines.insert_one({
            "_id": med_id, "id": med_id, "name": "CEFTRIAXONE 1G INJ",
            "dosage_form": "INJECTION", "strength": "1g", "is_active": True, "total_stock": 100
        })
        med = mongo_db.medicines.find_one({"_id": med_id})
    test_med_id = med["id"]

    # Ensure second distinct formulary medicine exists for follow-up prescription
    med2 = mongo_db.medicines.find_one({"_id": {"$ne": test_med_id}, "is_active": {"$in": [True, 1]}, "is_archived": {"$ne": True}})
    if not med2:
        med2_id = 9102
        mongo_db.medicines.insert_one({
            "_id": med2_id, "id": med2_id, "name": "PANTOPRAZOLE 40MG TAB",
            "dosage_form": "TABLET", "strength": "40mg", "is_active": True, "total_stock": 100
        })
        med2 = mongo_db.medicines.find_one({"_id": med2_id})
    test_med2_id = med2["id"]

    # =========================================================================
    # TEST 1: Doctor Ward Listing Endpoint (BUG 1 FIX)
    # =========================================================================
    print("\n--- TEST 1: Doctor Ward Listing (GET /api/doctor/wards) ---")
    wards_res = doctor_routes.get_doctor_wards(current_user=doctor_user)
    assert "wards" in wards_res
    assert wards_res["count"] > 0
    found_ward = next((w for w in wards_res["wards"] if w["id"] == ward_id), None)
    assert found_ward is not None, f"Ward {ward_id} must be in returned doctor wards"
    assert "total_beds" in found_ward
    assert "occupied_beds" in found_ward
    assert "available_beds" in found_ward
    print(f"PASS: Doctor can access active wards: {wards_res['count']} wards found. Ward {ward_id} available beds: {found_ward['available_beds']}")

    # =========================================================================
    # TEST 2: Doctor Bed Listing Endpoint (BUG 1 FIX)
    # =========================================================================
    print("\n--- TEST 2: Doctor Bed Listing (GET /api/doctor/wards/{ward_id}/beds) ---")
    beds_res = doctor_routes.get_doctor_ward_beds(ward_id=ward_id, patient_id=None, current_user=doctor_user)
    assert "beds" in beds_res
    assert len(beds_res["beds"]) >= 2
    bed1 = next((b for b in beds_res["beds"] if b["id"] == 1), None)
    bed2 = next((b for b in beds_res["beds"] if b["id"] == 2), None)
    assert bed1 is not None and bed1["is_available"] is True
    assert bed2 is not None and bed2["is_available"] is True
    assert bed1["status"] == "AVAILABLE"
    print(f"PASS: Ward {ward_id} beds retrieved successfully. Bed 1 and Bed 2 are AVAILABLE.")

    # =========================================================================
    # TEST 3: Receptionist Registration Without Bed Assignment (BUG 3 FIX)
    # =========================================================================
    print("\n--- TEST 3: Receptionist Registration Without Bed Allocation (BUG 3 FIX) ---")
    pat_payload = {
        "full_name": "E2E INTAKE PATIENT ONE",
        "age": 42,
        "gender": "MALE",
        "mobile_number": "9876543210",
        "problem_category": "GENERAL MEDICINE",
        "chief_complaint": "HIGH GRADE FEVER WITH CHILLS",
        "doctor_id": doctor_user.id,
        "is_admitted": False,
        "ward_id": None,
        "bed_id": None,
    }
    reg_res = hospital_routes.create_hospital_patient(pat_payload, current_user=receptionist_user)
    created_pat = reg_res["patient"]
    patient1_id = created_pat["id"]
    print(f"Registered patient ID: {patient1_id} ({created_pat['full_name']})")

    # Verify MongoDB patient state
    db_pat1 = mongo_db.patients.find_one({"_id": patient1_id})
    assert db_pat1["is_active"] in (True, 1)
    assert db_pat1["lifecycle_status"] == "ACTIVE"
    assert db_pat1.get("is_admitted") in (False, None, 0)
    assert db_pat1.get("ward_id") is None
    assert db_pat1.get("bed_id") is None

    # Verify encounter is OPD
    enc1 = mongo_db.encounters.find_one({"patient_id": patient1_id, "status": "ACTIVE"})
    assert enc1 is not None
    assert enc1.get("encounter_type") == "OPD"
    assert enc1.get("bed_id") is None
    print(f"PASS: Patient {patient1_id} successfully registered via Receptionist counter as OPD with NO bed allocation.")

    # =========================================================================
    # TEST 4: Doctor Bed Allocation via Prescription (BUG 2 & BUG 4 FIX)
    # =========================================================================
    print("\n--- TEST 4: Doctor Inpatient Admission & Bed Allocation on Prescription (BUG 2) ---")
    rx_req = PrescriptionCreate(
        patient_id=patient1_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="ONCE_DAILY",
                duration_days=5,
                start_date=date.today(),
                start_time=time(8, 0, 0),
                instructions="Infuse over 30 mins",
            )
        ],
        notes="Admitted for IV antibiotic therapy and close monitoring",
        admit_patient=True,
        ward_id=ward_id,
        bed_id=1,
    )
    rx_res = doctor_routes.create_prescription(rx_req, current_user=doctor_user)
    assert rx_res["bed_assignment"] is not None
    assert rx_res["bed_assignment"]["ward_id"] == ward_id
    assert rx_res["bed_assignment"]["bed_id"] == 1
    print(f"PASS: Prescription #{rx_res['prescription_id']} created with bed allocation: {rx_res['bed_assignment']}")

    # Verify Bed 1 in MongoDB is occupied by patient1
    db_bed1 = mongo_db.beds.find_one({"_id": 1})
    assert db_bed1["is_occupied"] in (1, True)
    assert db_bed1["occupied_by_patient_id"] == patient1_id

    # Verify Patient 1 in MongoDB is admitted with ward and bed
    db_pat1_after = mongo_db.patients.find_one({"_id": patient1_id})
    assert db_pat1_after["is_admitted"] in (True, 1)
    assert db_pat1_after["ward_id"] == ward_id
    assert db_pat1_after["bed_id"] == 1

    # Verify Encounter in MongoDB is updated to INPATIENT
    db_enc1_after = mongo_db.encounters.find_one({"patient_id": patient1_id, "status": "ACTIVE"})
    assert db_enc1_after["encounter_type"] == "INPATIENT"
    assert db_enc1_after["ward_id"] == ward_id
    assert db_enc1_after["bed_id"] == 1
    print("PASS: Bed 1, Patient 1, and Encounter records atomically synchronized in MongoDB.")

    # Verify Bed listing now shows Bed 1 as OCCUPIED
    beds_check = doctor_routes.get_doctor_ward_beds(ward_id=ward_id, patient_id=None, current_user=doctor_user)
    check_b1 = next(b for b in beds_check["beds"] if b["id"] == 1)
    assert check_b1["is_occupied"] is True
    assert check_b1["is_available"] is False
    assert check_b1["status"] == "OCCUPIED"

    # But for patient1 themselves, Bed 1 shows is_available: True (can be re-selected/confirmed)
    beds_self = doctor_routes.get_doctor_ward_beds(ward_id=ward_id, patient_id=patient1_id, current_user=doctor_user)
    self_b1 = next(b for b in beds_self["beds"] if b["id"] == 1)
    assert self_b1["is_available"] is True
    print("PASS: Bed 1 is OCCUPIED for third parties, but remains selectable for current assigned patient.")

    # =========================================================================
    # TEST 5: Double Bed Allocation Prevention (HTTP 409 Conflict)
    # =========================================================================
    print("\n--- TEST 5: Concurrency / Double Bed Allocation Prevention (HTTP 409) ---")
    # Register Patient 2
    pat2_payload = {
        "full_name": "E2E INTAKE PATIENT TWO",
        "age": 35,
        "gender": "FEMALE",
        "mobile_number": "9876543211",
        "problem_category": "CARDIOLOGY",
        "chief_complaint": "CHEST TIGHTNESS",
        "doctor_id": doctor_user.id,
        "is_admitted": False,
        "ward_id": None,
        "bed_id": None,
    }
    reg2_res = hospital_routes.create_hospital_patient(pat2_payload, current_user=receptionist_user)
    patient2_id = reg2_res["patient"]["id"]

    rx_dup_req = PrescriptionCreate(
        patient_id=patient2_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=ward_id,
        bed_id=1,  # Already occupied by patient1!
    )

    try:
        doctor_routes.create_prescription(rx_dup_req, current_user=doctor_user)
        assert False, "Double allocation of Bed 1 must raise HTTP 409 Conflict"
    except HTTPException as exc:
        assert exc.status_code == 409, f"Expected HTTP 409, got {exc.status_code}"
        assert "already occupied" in exc.detail.lower()
        print(f"PASS: Double allocation blocked with HTTP 409 Conflict: '{exc.detail}'")

    # =========================================================================
    # TEST 6: Moving Patient to Another Bed (Releases Old Bed)
    # =========================================================================
    print("\n--- TEST 6: Patient Bed Transfer / Reassignment ---")
    rx_move_req = PrescriptionCreate(
        patient_id=patient1_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med2_id,
                dose="40mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=2,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=ward_id,
        bed_id=2,  # Move patient1 from Bed 1 to Bed 2
    )
    rx_move_res = doctor_routes.create_prescription(rx_move_req, current_user=doctor_user)
    assert rx_move_res["bed_assignment"]["bed_id"] == 2

    # Old Bed 1 must now be released (unoccupied)
    old_b1 = mongo_db.beds.find_one({"_id": 1})
    assert old_b1["is_occupied"] in (0, False)
    assert old_b1["occupied_by_patient_id"] is None

    # New Bed 2 must now be occupied by patient1
    new_b2 = mongo_db.beds.find_one({"_id": 2})
    assert new_b2["is_occupied"] in (1, True)
    assert new_b2["occupied_by_patient_id"] == patient1_id
    print("PASS: Patient moved from Bed 1 to Bed 2. Old Bed 1 released, New Bed 2 occupied.")

    # Now Patient 2 CAN take Bed 1
    rx_pat2_ok = PrescriptionCreate(
        patient_id=patient2_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=ward_id,
        bed_id=1,
    )
    rx_pat2_res = doctor_routes.create_prescription(rx_pat2_ok, current_user=doctor_user)
    assert rx_pat2_res["bed_assignment"]["bed_id"] == 1
    print("PASS: Freed Bed 1 successfully allocated to Patient 2.")

    # =========================================================================
    # TEST 7: Discharge Releases Bed and Syncs Patient
    # =========================================================================
    print("\n--- TEST 7: Discharge Releases Bed and Synchronizes Patient Status ---")
    # Mark billing as PAID for patient 1 so discharge succeeds
    mongo_db.patient_billing.update_one(
        {"patient_id": patient1_id},
        {"$set": {"bill_status": "PAID"}},
        upsert=True
    )
    discharge_res = admin_routes.discharge_patient(
        patient_id=patient1_id,
        request={"discharge_reason": "Patient clinically recovered and discharged home"},
        current_user=admin_user,
    )
    print("Discharge message:", discharge_res["message"])

    # Bed 2 must now be released
    rel_b2 = mongo_db.beds.find_one({"_id": 2})
    assert rel_b2["is_occupied"] in (0, False)
    assert rel_b2["occupied_by_patient_id"] is None
    print("PASS: Bed 2 released upon discharge (is_occupied: 0, occupied_by_patient_id: None).")

    # Patient 1 must be marked DISCHARGED with bed_id: None
    db_pat1_disc = mongo_db.patients.find_one({"_id": patient1_id})
    assert db_pat1_disc["is_active"] in (False, 0)
    assert db_pat1_disc["lifecycle_status"] == "DISCHARGED"
    assert db_pat1_disc["bed_id"] is None
    assert db_pat1_disc["ward_id"] is None
    print("PASS: Patient 1 lifecycle status is DISCHARGED with ward_id: None and bed_id: None.")

    # =========================================================================
    # TEST 8: Prescribing / Assigning Bed to Discharged Patient Rejected
    # =========================================================================
    print("\n--- TEST 8: Discharged Patient Cannot Receive Bed or Prescription ---")
    rx_disc_req = PrescriptionCreate(
        patient_id=patient1_id,
        medicines=[
            PrescriptionItemCreate(
                medicine_id=test_med_id,
                dose="1g",
                route="IV",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=date.today(),
                start_time=time(8, 0, 0),
            )
        ],
        admit_patient=True,
        ward_id=ward_id,
        bed_id=2,
    )
    try:
        doctor_routes.create_prescription(rx_disc_req, current_user=doctor_user)
        assert False, "Prescribing for a discharged patient must raise HTTPException 400"
    except HTTPException as exc:
        assert exc.status_code == 400
        print(f"PASS: Prescription rejected for discharged patient: '{exc.detail}'")

    # Cleanup Patient 2 by discharging them as well to leave DB clean
    mongo_db.patient_billing.update_one(
        {"patient_id": patient2_id},
        {"$set": {"bill_status": "PAID"}},
        upsert=True
    )
    admin_routes.discharge_patient(
        patient_id=patient2_id,
        request={"discharge_reason": "End of test cleanup"},
        current_user=admin_user,
    )
    print("Cleaned up Patient 2 via discharge.")

    print("\n" + "=" * 80)
    print("ALL 8 WARD & BED ASSIGNMENT E2E INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
