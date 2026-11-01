import os
import sys
from pathlib import Path
from datetime import datetime, date, time, timedelta
from types import SimpleNamespace
from fastapi import HTTPException

# Explicitly ensure test database is targeted
os.environ["MONGODB_DATABASE"] = "smartmedchart_e2e_test"

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes import doctor as doctor_routes
from app.routes import admin as admin_routes
from app.routes import nurse as nurse_routes
from app.schemas.prescription import PrescriptionCreate


def make_user(role_name: str, user_id: int, username: str, permission_names: list[str]):
    perms = [SimpleNamespace(name=p) for p in permission_names]
    role = SimpleNamespace(id=1 if role_name == "Doctor" else 4, name=role_name, permissions=perms)
    return SimpleNamespace(id=user_id, username=username, full_name=f"Dr. {username.capitalize()}", role=role)


def run_tests():
    print("=" * 75)
    print("SMARTMEDCHART E2E TEST: PRESCRIPTION, ON-ROUND & GLOBAL DISCHARGE")
    print("Database:", mongo_db.name)
    print("=" * 75)
    assert mongo_db.name == "smartmedchart_e2e_test", "Safety block: MUST run on smartmedchart_e2e_test only!"

    # 1. Setup Test Actors & Inpatient in test DB
    db_doctor = mongo_db.users.find_one({"role_id": 1}) or mongo_db.users.find_one({"username": {"$regex": "doc", "$options": "i"}})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})

    assert db_doctor, "Doctor user must exist in test DB"
    assert db_admin, "Admin user must exist in test DB"

    doctor_user = make_user("Doctor", db_doctor["id"], db_doctor["username"], [
        "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "STOP_PRESCRIPTION", "VIEW_MEDICATION_SCHEDULE"
    ])
    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], [
        "MANAGE_SYSTEM", "VIEW_PATIENT", "EDIT_PATIENT", "MANAGE_INVENTORY"
    ])

    print(f"Active Actors -> Doctor: {doctor_user.username} (ID: {doctor_user.id}), Admin: {admin_user.username} (ID: {admin_user.id})")

    # Ensure test medicine exists
    now = datetime.utcnow().isoformat(timespec="microseconds")
    med = mongo_db.medicines.find_one({"is_active": {"$in": [True, 1]}})
    if not med:
        med_id = 9999
        mongo_db.medicines.insert_one({
            "_id": med_id,
            "id": med_id,
            "name": "CEFTRIAXONE 1G",
            "generic_name": "Ceftriaxone Sodium",
            "strength": "1 g",
            "dosage_form": "INJECTION",
            "unit": "VIAL",
            "total_stock": 100,
            "is_active": True,
            "is_archived": False,
            "created_at": now,
            "updated_at": now,
        })
        med = mongo_db.medicines.find_one({"_id": med_id})

    # Ensure ward & bed exists
    ward = mongo_db.wards.find_one({"is_active": {"$in": [True, 1]}})
    if not ward:
        ward_id = 901
        mongo_db.wards.insert_one({
            "_id": ward_id,
            "id": ward_id,
            "name": "Intensive Care Unit (ICU)",
            "code": "ICU-A",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
        ward = mongo_db.wards.find_one({"_id": ward_id})

    bed = mongo_db.beds.find_one({"ward_id": ward["_id"], "is_active": {"$in": [True, 1]}})
    if not bed:
        bed_id = 9001
        mongo_db.beds.insert_one({
            "_id": bed_id,
            "id": bed_id,
            "ward_id": ward["_id"],
            "bed_number": "ICU-01",
            "is_occupied": 0,
            "occupied_by_patient_id": None,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
        bed = mongo_db.beds.find_one({"_id": bed_id})

    # Create / initialize active test patient
    test_patient_id = 8888
    test_qr_token = f"QR-E2E-TEST-{test_patient_id}"

    mongo_db.patients.delete_many({"_id": test_patient_id})
    mongo_db.encounters.delete_many({"patient_id": test_patient_id})
    mongo_db.prescriptions.delete_many({"patient_id": test_patient_id})
    mongo_db.patient_round_assessments.delete_many({"patient_id": test_patient_id})
    mongo_db.patient_billing.delete_many({"patient_id": test_patient_id})

    mongo_db.patients.insert_one({
        "_id": test_patient_id,
        "id": test_patient_id,
        "patient_id": f"PAT-E2E-{test_patient_id}",
        "first_name": "ROHIT",
        "last_name": "SHARMA",
        "date_of_birth": "1988-04-30",
        "gender": "male",
        "weight_kg": 72.5,
        "mobile_number": "9876543210",
        "ward_id": ward["_id"],
        "bed_id": bed["_id"],
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "qr_token": test_qr_token,
        "qr_is_active": True,
        "admission_date": now,
        "created_at": now,
        "updated_at": now,
    })

    # Mark bed as occupied
    mongo_db.beds.update_one(
        {"_id": bed["_id"]},
        {"$set": {"is_occupied": 1, "occupied_by_patient_id": test_patient_id, "updated_at": now}}
    )

    # Active encounter assigned to doctor
    encounter_id = 88801
    mongo_db.encounters.insert_one({
        "_id": encounter_id,
        "id": encounter_id,
        "patient_id": test_patient_id,
        "doctor_id": doctor_user.id,
        "encounter_type": "INPATIENT",
        "status": "ACTIVE",
        "chief_complaint": "Acute lower respiratory infection with high-grade pyrexia",
        "symptom_duration": "3 days",
        "symptom_severity": "MODERATE",
        "admitted_at": now,
        "discharged_at": None,
        "discharge_reason": None,
        "discharged_by": None,
        "ward_id": ward["_id"],
        "bed_id": bed["_id"],
        "created_at": now,
        "updated_at": now,
    })

    # Initialize billing
    mongo_db.patient_billing.insert_one({
        "_id": test_patient_id,
        "id": test_patient_id,
        "patient_id": test_patient_id,
        "bill_status": "PENDING",
        "bill_amount": 5000.0,
        "created_at": now,
        "updated_at": now,
    })

    print(f"Created active test patient #{test_patient_id} assigned to Doctor #{doctor_user.id} in Bed #{bed['bed_number']}.")

    # =========================================================================
    # PART 1: FIX BUG 6 — WRITE PRESCRIPTION & VALIDATION
    # =========================================================================
    print("\n" + "=" * 50)
    print("PART 1: TESTING PRESCRIPTION WORKFLOW & DUPLICATE PROTECTION")
    print("=" * 50)

    # Record stock before prescription
    med_before = mongo_db.medicines.find_one({"_id": med["_id"]})
    stock_before = med_before.get("total_stock", 0)

    # Test 1A: Valid prescription creation
    print("\n[TEST 1A] Creating authorized prescription order...")
    rx_req = PrescriptionCreate(
        patient_id=test_patient_id,
        medicine_id=med["_id"],
        dose="1000 mg",
        route="IV",
        frequency="TWICE_DAILY",
        duration_days=3,
        start_date=date.today(),
        start_time=time(8, 0),
        is_stat=False,
        instructions="Administer slowly over 30 minutes via IV infusion",
        notes="Clinical trial evaluation regimen",
    )

    rx_res = doctor_routes.create_prescription(request=rx_req, current_user=doctor_user)
    assert rx_res["prescription_id"] > 0, "Prescription ID must be assigned"
    assert rx_res["schedule_count"] == 6, f"Expected 6 schedules for 3 days BID, got {rx_res['schedule_count']}"
    print(f"PASS: Prescription #{rx_res['prescription_id']} created with {rx_res['schedule_count']} schedules.")

    # Test 1B: Verify schedules created in MongoDB
    print("\n[TEST 1B] Verifying medication_schedules in MongoDB...")
    created_schedules = list(mongo_db.medication_schedules.find({
        "prescription_item_id": rx_res["prescription_item_id"],
        "status": {"$in": ["SCHEDULED", "UPCOMING"]},
    }))
    assert len(created_schedules) == 6, f"Expected 6 active schedules, found {len(created_schedules)}"
    print(f"PASS: Verified {len(created_schedules)} active medication schedules in MongoDB.")

    # Test 1C: Verify inventory NOT deducted on prescription creation
    print("\n[TEST 1C] Verifying inventory is NOT deducted on prescription creation...")
    med_after = mongo_db.medicines.find_one({"_id": med["_id"]})
    stock_after = med_after.get("total_stock", 0)
    assert stock_before == stock_after, f"Inventory was improperly changed! Before: {stock_before}, After: {stock_after}"
    print(f"PASS: Pharmacy inventory unchanged ({stock_before} -> {stock_after}) as required.")

    # Test 1D: Duplicate prescription protection
    print("\n[TEST 1D] Verifying duplicate prescription submission protection...")
    try:
        doctor_routes.create_prescription(request=rx_req, current_user=doctor_user)
        assert False, "Duplicate prescription should have raised HTTPException 409!"
    except HTTPException as exc:
        assert exc.status_code == 409, f"Expected 409 Conflict, got {exc.status_code}"
        print(f"PASS: Duplicate order caught and rejected with HTTP 409: {exc.detail}")

    # =========================================================================
    # PART 2: DOCTOR ON-ROUND SYSTEM
    # =========================================================================
    print("\n" + "=" * 50)
    print("PART 2: TESTING DOCTOR ON-ROUND SYSTEM")
    print("=" * 50)

    # Test 2A: Verify patient wristband QR token
    print("\n[TEST 2A] Verifying patient wristband QR during ward round...")
    verify_req = doctor_routes.RoundVerifyQRRequest(qr_token=test_qr_token)
    verify_res = doctor_routes.doctor_verify_round_qr(request=verify_req, current_user=doctor_user)
    assert verify_res["valid"] is True, f"Expected QR to be valid, got: {verify_res}"
    assert verify_res["patient"]["id"] == test_patient_id
    assert verify_res["patient"]["bed_number"] == bed["bed_number"]
    assert len(verify_res["patient"]["active_prescriptions"]) >= 1
    print(f"PASS: QR successfully verified for {verify_res['patient']['full_name']} in Bed {verify_res['patient']['bed_number']}.")

    # Test 2B: Invalid or unassigned QR token rejected
    print("\n[TEST 2B] Verifying invalid QR rejection...")
    bad_verify = doctor_routes.RoundVerifyQRRequest(qr_token="NON-EXISTENT-TOKEN-999")
    bad_res = doctor_routes.doctor_verify_round_qr(request=bad_verify, current_user=doctor_user)
    assert bad_res["valid"] is False, "Invalid QR token must be rejected"
    print(f"PASS: Invalid QR correctly rejected: {bad_res['message']}")

    # Test 2C: Doctor round active roster list
    print("\n[TEST 2C] Testing GET /api/doctor/rounds/patients roster...")
    roster = doctor_routes.get_doctor_round_patients(current_user=doctor_user)
    matched = [p for p in roster if p["id"] == test_patient_id]
    assert len(matched) == 1, f"Patient {test_patient_id} should appear in round roster"
    assert matched[0]["bed_number"] == bed["bed_number"]
    print(f"PASS: Round roster returned {len(roster)} patients; test patient present with Bed {matched[0]['bed_number']}.")

    # Test 2D: Submit bedside recovery assessment
    print("\n[TEST 2D] Recording bedside recovery assessment (Round 1: 55%)...")
    assess_req = doctor_routes.RoundAssessmentCreate(
        patient_id=test_patient_id,
        improvement_percentage=55,
        clinical_notes="Patient temperature down to 99.2F. Dyspnea resolving. Lungs clearer on auscultation.",
    )
    assess_res = doctor_routes.create_round_assessment(request=assess_req, current_user=doctor_user)
    assert assess_res["assessment"]["improvement_percentage"] == 55
    assert assess_res["assessment"]["doctor_id"] == doctor_user.id
    print(f"PASS: Recovery assessment #1 saved ({assess_res['assessment']['improvement_percentage']}%).")

    # Record second assessment for trajectory
    print("[TEST 2D.2] Recording bedside recovery assessment (Round 2: 85%)...")
    assess_req2 = doctor_routes.RoundAssessmentCreate(
        patient_id=test_patient_id,
        improvement_percentage=85,
        clinical_notes="Patient afebrile for 24 hours. Cough completely resolved. Ready for discharge planning.",
    )
    assess_res2 = doctor_routes.create_round_assessment(request=assess_req2, current_user=doctor_user)
    assert assess_res2["assessment"]["improvement_percentage"] == 85
    print(f"PASS: Recovery assessment #2 saved ({assess_res2['assessment']['improvement_percentage']}%).")

    # Test 2E: Retrieve chronological assessments for progress graph
    print("\n[TEST 2E] Fetching chronological assessments for progress trajectory...")
    assessments_history = doctor_routes.get_patient_round_assessments(patient_id=test_patient_id, current_user=doctor_user)
    assert len(assessments_history) >= 2, f"Expected at least 2 assessments, found {len(assessments_history)}"
    assert assessments_history[0]["improvement_percentage"] == 55
    assert assessments_history[1]["improvement_percentage"] == 85
    print(f"PASS: Retrieved {len(assessments_history)} assessments in chronological order (55% -> 85%).")

    # =========================================================================
    # PART 3: GLOBAL PATIENT DISCHARGE & DASHBOARD SYNCHRONIZATION
    # =========================================================================
    print("\n" + "=" * 50)
    print("PART 3: TESTING GLOBAL DISCHARGE & DASHBOARD SYNCHRONIZATION")
    print("=" * 50)

    # Mark bill paid to permit discharge
    mongo_db.patient_billing.update_one(
        {"patient_id": test_patient_id},
        {"$set": {"bill_status": "PAID", "paid_at": now}}
    )

    # Test 3A: Execute global discharge
    print("\n[TEST 3A] Executing global discharge workflow...")
    discharge_res = admin_routes.discharge_patient(
        patient_id=test_patient_id,
        request={"discharge_reason": "Clinical recovery achieved, afebrile 24h, oral treatment completed."},
        current_user=admin_user,
    )
    assert discharge_res["patient"]["is_active"] is False, "Patient must be inactive"
    print(f"PASS: Discharge completed. Message: {discharge_res['message']}")

    # Verify MongoDB state post-discharge
    print("\n[TEST 3B] Verifying MongoDB state post-discharge...")
    p_discharged = mongo_db.patients.find_one({"_id": test_patient_id})
    assert p_discharged["is_active"] is False, "Patient is_active must be False"
    assert p_discharged["lifecycle_status"] == "DISCHARGED", "lifecycle_status must be DISCHARGED"
    assert p_discharged["qr_is_active"] is False, "qr_is_active must be False"
    assert p_discharged["bed_id"] is None, "Patient bed_id must be unassigned"
    print("[OK] Patient document marked inactive, DISCHARGED lifecycle, QR deactivated.")

    # Verify bed released
    bed_check = mongo_db.beds.find_one({"_id": bed["_id"]})
    assert bed_check["is_occupied"] in (0, False), "Bed must be unoccupied"
    assert bed_check["occupied_by_patient_id"] is None, "Bed occupant must be None"
    print(f"[OK] Bed #{bed_check['bed_number']} confirmed unoccupied (is_occupied=0, occupied_by=None).")

    # Verify unadministered schedules cancelled
    cancelled_scheds = list(mongo_db.medication_schedules.find({
        "prescription_item_id": rx_res["prescription_item_id"],
        "status": "CANCELLED",
    }))
    assert len(cancelled_scheds) == 6, f"Expected 6 CANCELLED schedules, got {len(cancelled_scheds)}"
    print(f"[OK] All {len(cancelled_scheds)} unadministered schedules marked CANCELLED.")

    # Verify encounter marked DISCHARGED
    enc_check = mongo_db.encounters.find_one({"_id": encounter_id})
    assert enc_check["status"] == "DISCHARGED"
    assert enc_check["discharge_reason"] is not None
    print(f"[OK] Encounter #{encounter_id} marked DISCHARGED with reason: '{enc_check['discharge_reason']}'.")

    # Test 3C: Synchronization across all active dashboards
    print("\n[TEST 3C] Verifying patient disappeared from ALL active dashboards...")
    # Doctor active search
    doc_active_patients = doctor_routes.search_patients(current_user=doctor_user)
    assert not any(p["id"] == test_patient_id for p in doc_active_patients), "Discharged patient must NOT appear in Doctor active list!"

    # Doctor rounds roster
    rounds_active = doctor_routes.get_doctor_round_patients(current_user=doctor_user)
    assert not any(p["id"] == test_patient_id for p in rounds_active), "Discharged patient must NOT appear in Doctor round roster!"

    # Admin active lifecycle
    lifecycle = admin_routes.get_patient_lifecycle(current_user=admin_user)
    assert not any(p["id"] == test_patient_id for p in lifecycle["active"]), "Discharged patient must NOT appear in Admin active lifecycle!"
    assert any(p["id"] == test_patient_id for p in lifecycle["discharged"]), "Discharged patient MUST appear in Admin discharged lifecycle!"

    # QR scan attempt on discharged patient
    qr_attempt = doctor_routes.doctor_verify_round_qr(
        request=doctor_routes.RoundVerifyQRRequest(qr_token=test_qr_token),
        current_user=doctor_user
    )
    assert qr_attempt["valid"] is False, "QR scan of discharged patient must be rejected!"

    print("PASS: Confirmed discharged patient is completely absent from all active rosters (Doctor, On-Round, Admin, QR).")

    # Test 3D: Historical records preserved
    print("\n[TEST 3D] Verifying historical records are preserved and readable...")
    rx_history = doctor_routes.get_prescription_history(patient_id=test_patient_id, current_user=doctor_user)
    assert len(rx_history) >= 1, "Historical prescription must remain accessible"

    assessments_post_discharge = doctor_routes.get_patient_round_assessments(patient_id=test_patient_id, current_user=doctor_user)
    assert len(assessments_post_discharge) == 2, "Historical assessments must remain accessible after discharge"
    print(f"PASS: Verified historical records preserved: {len(rx_history)} prescriptions and {len(assessments_post_discharge)} round assessments.")

    # Test 3E: Readmission handling
    print("\n[TEST 3E] Testing readmission handling with new encounter & bed...")
    readmit_req = admin_routes.ReadmitPatientRequest(
        ward_id=ward["_id"],
        bed_id=bed["_id"],
        doctor_id=doctor_user.id,
        chief_complaint="Post-discharge follow-up admission for mild relapse",
        admission_notes="Readmitted for 48h observation",
    )
    readmit_res = admin_routes.readmit_patient(
        patient_id=test_patient_id,
        request=readmit_req,
        current_user=admin_user,
    )
    assert readmit_res["is_active"] is True
    assert readmit_res["encounter_id"] != encounter_id, "Readmission must create a NEW encounter ID"

    # Verify historical encounter was untouched
    past_enc = mongo_db.encounters.find_one({"_id": encounter_id})
    assert past_enc["status"] == "DISCHARGED", "Past encounter must remain DISCHARGED"

    # Verify new encounter is active
    new_enc = mongo_db.encounters.find_one({"_id": readmit_res["encounter_id"]})
    assert new_enc["status"] == "ACTIVE"
    assert new_enc["chief_complaint"] == "Post-discharge follow-up admission for mild relapse"

    print(f"PASS: Patient successfully readmitted! New Encounter #{new_enc['_id']} is ACTIVE; Historical Encounter #{past_enc['_id']} is DISCHARGED.")

    print("\n" + "=" * 75)
    print("ALL TESTS PASSED SUCCESSFULLY (10/10 PASS - 0 FAILURES)")
    print("=" * 75)


if __name__ == "__main__":
    run_tests()
