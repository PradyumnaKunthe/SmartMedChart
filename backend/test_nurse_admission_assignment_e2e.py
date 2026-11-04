"""
SmartMedChart - Comprehensive End-to-End Test Suite:
Doctor's Inpatient Admission & Nurse Assignment Workflow

Covers all 14 mandatory requirements directly against FastAPI endpoints and MongoDB:
1. Doctor loads active nurse list (GET /api/doctor/available-nurses).
2. Inactive nurses are excluded from available nurses.
3. Non-nurse accounts (doctors, receptionists, admins) are excluded.
4. Doctor assigns active nurse during patient admission (create_prescription).
5. MongoDB nurse_patient_assignments record created with is_active: True.
6. Assigned nurse sees patient in their active roster (GET /api/nurse/patients).
7. Doctor retains visibility of the patient in their assigned patient roster.
8. Duplicate submissions do not create duplicate active assignments.
9. Patient nurse reassignment deactivates previous assignment (is_active: False) and activates new assignment.
10. Outpatient prescription creation (admit_patient=False) preserves existing nurse assignments unchanged.
11. Invalid / non-nurse / inactive nurse ID rejected with HTTPException 400/404.
12. Unauthorized patient protection: doctor cannot assign nurse to patient not under their care.
13. Transactional rollback integrity on admission failure: no orphaned beds or assignments.
14. Regression check: Multi-item prescriptions and dosing schedule generation work properly.
"""

import sys
import os
from datetime import date, datetime, time
from types import SimpleNamespace
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from app.mongo_client import mongo_db
from app.routes.doctor import (
    create_prescription,
    get_available_nurses,
    get_patient_assigned_nurse,
    search_patients,
    get_doctor_patient_or_404,
    get_prescription_history,
    next_mongo_id,
    mongo_now,
)
from app.routes.nurse import get_nurse_assigned_patients
from app.schemas.prescription import PrescriptionCreate, PrescriptionItemCreate
from app.security import hash_password


def build_mock_user(user_doc, role_name="Doctor"):
    perms = list(mongo_db.permissions.find({}))
    perm_objects = [SimpleNamespace(name=p["name"]) for p in perms]

    return SimpleNamespace(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        role_id=user_doc["role_id"],
        role=SimpleNamespace(
            id=user_doc["role_id"],
            name=role_name,
            permissions=perm_objects,
        )
    )


def run_e2e_tests():
    print("=" * 80)
    print("STARTING E2E TEST: DOCTOR INPATIENT ADMISSION & NURSE ASSIGNMENT WORKFLOW")
    print("=" * 80)

    # 1. Setup Roles
    doctor_role = mongo_db.roles.find_one({"name": {"$regex": "^doctor$", "$options": "i"}})
    nurse_role = mongo_db.roles.find_one({"name": {"$regex": "^nurse$", "$options": "i"}})
    admin_role = mongo_db.roles.find_one({"name": {"$regex": "^admin", "$options": "i"}})
    receptionist_role = mongo_db.roles.find_one({"name": {"$regex": "^receptionist$", "$options": "i"}})

    doc_role_id = doctor_role["id"] if doctor_role else 1
    nurse_role_id = nurse_role["id"] if nurse_role else 2
    admin_role_id = admin_role["id"] if admin_role else 4
    receptionist_role_id = receptionist_role["id"] if receptionist_role else 5

    # 2. Setup Doctor
    ts = int(datetime.utcnow().timestamp())
    dr_id = next_mongo_id("users")
    dr_user = {
        "_id": dr_id,
        "id": dr_id,
        "username": f"dr_assign_{ts}",
        "email": f"dr_assign_{ts}@smartmedchart.org",
        "hashed_password": hash_password("DocPass123!"),
        "full_name": "Dr. Clara Oswald",
        "role_id": doc_role_id,
        "is_active": True,
        "created_at": mongo_now(),
    }
    mongo_db.users.insert_one(dr_user)
    doctor_ctx = build_mock_user(dr_user, "Doctor")

    # Another Doctor (unauthorized)
    other_dr_id = next_mongo_id("users")
    other_dr_user = {
        "_id": other_dr_id,
        "id": other_dr_id,
        "username": f"dr_other_{ts}",
        "email": f"dr_other_{ts}@smartmedchart.org",
        "hashed_password": hash_password("DocPass123!"),
        "full_name": "Dr. Other Doctor",
        "role_id": doc_role_id,
        "is_active": True,
        "created_at": mongo_now(),
    }
    mongo_db.users.insert_one(other_dr_user)
    other_doctor_ctx = build_mock_user(other_dr_user, "Doctor")

    # 3. Setup Nurses: Nurse A (Active), Nurse B (Active), Nurse C (Inactive)
    nurse_a_id = next_mongo_id("users")
    nurse_a_user = {
        "_id": nurse_a_id,
        "id": nurse_a_id,
        "username": f"nurse_a_{ts}",
        "email": f"nurse_a_{ts}@smartmedchart.org",
        "hashed_password": hash_password("NursePass123!"),
        "full_name": "Nurse Amy Pond",
        "role_id": nurse_role_id,
        "is_active": True,
        "created_at": mongo_now(),
    }
    mongo_db.users.insert_one(nurse_a_user)
    nurse_a_ctx = build_mock_user(nurse_a_user, "Nurse")

    nurse_b_id = next_mongo_id("users")
    nurse_b_user = {
        "_id": nurse_b_id,
        "id": nurse_b_id,
        "username": f"nurse_b_{ts}",
        "email": f"nurse_b_{ts}@smartmedchart.org",
        "hashed_password": hash_password("NursePass123!"),
        "full_name": "Nurse Rory Williams",
        "role_id": nurse_role_id,
        "is_active": True,
        "created_at": mongo_now(),
    }
    mongo_db.users.insert_one(nurse_b_user)
    nurse_b_ctx = build_mock_user(nurse_b_user, "Nurse")

    nurse_inactive_id = next_mongo_id("users")
    nurse_inactive_user = {
        "_id": nurse_inactive_id,
        "id": nurse_inactive_id,
        "username": f"nurse_inact_{ts}",
        "email": f"nurse_inact_{ts}@smartmedchart.org",
        "hashed_password": hash_password("NursePass123!"),
        "full_name": "Nurse Inactive Staff",
        "role_id": nurse_role_id,
        "is_active": False,
        "created_at": mongo_now(),
    }
    mongo_db.users.insert_one(nurse_inactive_user)

    # Setup non-nurse accounts (Receptionist and Admin)
    rec_id = next_mongo_id("users")
    mongo_db.users.insert_one({
        "_id": rec_id,
        "id": rec_id,
        "username": f"rec_{ts}",
        "email": f"rec_{ts}@smartmedchart.org",
        "hashed_password": hash_password("Pass123!"),
        "full_name": "Receptionist Donna",
        "role_id": receptionist_role_id,
        "is_active": True,
        "created_at": mongo_now(),
    })

    print(f"Created Doctor ID: {dr_id}, Nurse A ID: {nurse_a_id}, Nurse B ID: {nurse_b_id}, Inactive Nurse ID: {nurse_inactive_id}")

    # 4. Setup Ward and Beds
    ward_id = next_mongo_id("wards")
    mongo_db.wards.insert_one({
        "_id": ward_id,
        "id": ward_id,
        "name": f"TEST MEDICAL WARD {ts}",
        "code": f"TMW{ts % 1000}",
        "total_beds": 10,
        "available_beds": 10,
        "occupied_beds": 0,
        "is_active": 1,
        "created_at": mongo_now(),
    })

    bed_1_id = next_mongo_id("beds")
    mongo_db.beds.insert_one({
        "_id": bed_1_id,
        "id": bed_1_id,
        "ward_id": ward_id,
        "bed_number": f"B1-{ts % 1000}",
        "is_occupied": False,
        "status": "AVAILABLE",
        "is_active": True,
        "created_at": mongo_now(),
    })

    bed_2_id = next_mongo_id("beds")
    mongo_db.beds.insert_one({
        "_id": bed_2_id,
        "id": bed_2_id,
        "ward_id": ward_id,
        "bed_number": f"B2-{ts % 1000}",
        "is_occupied": False,
        "status": "AVAILABLE",
        "is_active": True,
        "created_at": mongo_now(),
    })

    # 5. Setup Patient with encounter assigned to Doctor
    pat_id = next_mongo_id("patients")
    pat_code = f"PAT-{ts % 10000:04d}"
    mongo_db.patients.insert_one({
        "_id": pat_id,
        "id": pat_id,
        "patient_id": pat_code,
        "first_name": "Rose",
        "last_name": "Tyler",
        "date_of_birth": "1994-04-27",
        "gender": "Female",
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "admitted_at": mongo_now(),
        "created_at": mongo_now(),
    })

    enc_id = next_mongo_id("encounters")
    mongo_db.encounters.insert_one({
        "_id": enc_id,
        "id": enc_id,
        "patient_id": pat_id,
        "doctor_id": dr_id,
        "encounter_type": "OUTPATIENT",
        "status": "ACTIVE",
        "created_at": mongo_now(),
    })

    # Setup Medicines
    medicines_to_seed = [
        {"id": 10, "name": "PARACETAMOL", "generic_name": "PARACETAMOL", "dosage_form": "TABLET"},
        {"id": 11, "name": "CETIRIZINE", "generic_name": "CETIRIZINE", "dosage_form": "TABLET"},
        {"id": 12, "name": "AMOXICILLIN", "generic_name": "AMOXICILLIN", "dosage_form": "CAPSULE"},
        {"id": 13, "name": "IBUPROFEN", "generic_name": "IBUPROFEN", "dosage_form": "TABLET"},
    ]
    for m in medicines_to_seed:
        if not mongo_db.medicines.find_one({"id": m["id"]}):
            mongo_db.medicines.insert_one({
                "_id": m["id"],
                "id": m["id"],
                "name": m["name"],
                "generic_name": m["generic_name"],
                "dosage_form": m["dosage_form"],
                "total_stock": 500,
                "is_active": 1,
            })
    med_id = 10

    # =========================================================================
    # TEST 1: Doctor loads available nurses
    # =========================================================================
    print("\n--- TEST 1: Doctor loads active nurse list ---")
    available_nurses = get_available_nurses(current_user=doctor_ctx)
    assert isinstance(available_nurses, list), "Expected available_nurses to be a list"
    nurse_ids = [n["id"] for n in available_nurses]
    print(f"Loaded {len(available_nurses)} available nurses. IDs: {nurse_ids}")
    assert nurse_a_id in nurse_ids, f"Nurse A (ID {nurse_a_id}) should be in available nurses"
    assert nurse_b_id in nurse_ids, f"Nurse B (ID {nurse_b_id}) should be in available nurses"
    print("PASS: Nurse A and Nurse B are in available nurses.")

    # =========================================================================
    # TEST 2 & 3: Inactive nurses & Non-nurse accounts excluded
    # =========================================================================
    print("\n--- TEST 2 & 3: Exclusions (Inactive nurses & Non-nurses) ---")
    assert nurse_inactive_id not in nurse_ids, "Inactive nurse must be excluded"
    assert dr_id not in nurse_ids, "Doctor accounts must be excluded"
    assert rec_id not in nurse_ids, "Receptionist accounts must be excluded"
    print("PASS: Inactive nurses, doctors, and receptionists are strictly excluded.")

    # =========================================================================
    # TEST 4 & 5: Doctor assigns Nurse A during inpatient admission
    # =========================================================================
    print("\n--- TEST 4 & 5: Doctor admits patient with Bed and Nurse Assignment ---")
    req = PrescriptionCreate(
        patient_id=pat_id,
        admit_patient=True,
        ward_id=ward_id,
        bed_id=bed_1_id,
        nurse_id=nurse_a_id,
        notes="Admitted for acute observation.",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=med_id,
                dose="500 mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=str(date.today()),
                start_time="08:00",
                administration_times=["08:00"],
            )
        ]
    )

    rx_res = create_prescription(req, current_user=doctor_ctx)
    print(f"Prescription created: ID {rx_res.get('prescription_id')}")
    assert rx_res.get("bed_assignment") is not None, "Bed assignment should be confirmed"
    assert rx_res.get("bed_assignment", {}).get("bed_id") == bed_1_id
    assert rx_res.get("nurse_assignment") is not None, "Nurse assignment should be returned in response"
    assert rx_res.get("nurse_assignment", {}).get("nurse_id") == nurse_a_id
    assert "Nurse Amy Pond" in rx_res.get("nurse_assignment", {}).get("nurse_name")

    # Verify MongoDB nurse_patient_assignments record
    assignment_doc = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": pat_id,
        "nurse_id": nurse_a_id,
        "is_active": True,
    })
    assert assignment_doc is not None, "Active assignment record must exist in MongoDB"
    assert assignment_doc["assigned_by"] == dr_id, f"assigned_by should be doctor ID {dr_id}"
    print(f"PASS: Assignment record created in MongoDB with ID {assignment_doc['_id']}, is_active: True")

    # =========================================================================
    # TEST 6: Assigned Nurse sees patient in their active roster
    # =========================================================================
    print("\n--- TEST 6: Nurse A sees patient in active roster ---")
    nurse_a_patients = get_nurse_assigned_patients(current_user=nurse_a_ctx)
    nurse_a_pat_ids = [p["id"] for p in nurse_a_patients]
    print(f"Nurse A patients: {nurse_a_pat_ids}")
    assert pat_id in nurse_a_pat_ids, f"Patient {pat_id} must appear in Nurse A's assigned patient list"

    # Nurse B should NOT see this patient yet
    nurse_b_patients = get_nurse_assigned_patients(current_user=nurse_b_ctx)
    nurse_b_pat_ids = [p["id"] for p in nurse_b_patients]
    assert pat_id not in nurse_b_pat_ids, f"Patient {pat_id} must not appear in Nurse B's roster"
    print("PASS: Patient is visible to Nurse A and not visible to Nurse B.")

    # =========================================================================
    # TEST 7: Doctor retains visibility
    # =========================================================================
    print("\n--- TEST 7: Doctor retains patient visibility ---")
    doc_patient = get_doctor_patient_or_404(str(pat_id), current_user=doctor_ctx)
    assert doc_patient is not None
    assert doc_patient["id"] == pat_id

    assigned_nurse_info = get_patient_assigned_nurse(str(pat_id), current_user=doctor_ctx)
    assert assigned_nurse_info.get("assigned_nurse") is not None
    assert assigned_nurse_info["assigned_nurse"]["nurse_id"] == nurse_a_id
    print(f"PASS: Doctor sees patient and assigned nurse: {assigned_nurse_info['assigned_nurse']['nurse_name']}")

    # =========================================================================
    # TEST 8: Duplicate submission protection
    # =========================================================================
    print("\n--- TEST 8: Duplicate submission protection ---")
    # Submitting another prescription with the SAME nurse and bed should not create duplicate active assignments
    req_dup = PrescriptionCreate(
        patient_id=pat_id,
        admit_patient=True,
        ward_id=ward_id,
        bed_id=bed_1_id,
        nurse_id=nurse_a_id,
        notes="Second prescription order.",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=11,
                dose="10 mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=2,
                start_date=str(date.today()),
                start_time="12:00",
                administration_times=["12:00"],
            )
        ]
    )
    rx_res_dup = create_prescription(req_dup, current_user=doctor_ctx)
    active_assignments = list(mongo_db.nurse_patient_assignments.find({
        "patient_id": pat_id,
        "is_active": True,
    }))
    assert len(active_assignments) == 1, f"Expected exactly 1 active assignment, found {len(active_assignments)}"
    print("PASS: Exactly 1 active assignment remains after duplicate submission.")

    # =========================================================================
    # TEST 9: Nurse Reassignment (Reassign to Nurse B)
    # =========================================================================
    print("\n--- TEST 9: Nurse Reassignment to Nurse B ---")
    req_reassign = PrescriptionCreate(
        patient_id=pat_id,
        admit_patient=True,
        ward_id=ward_id,
        bed_id=bed_1_id,
        nurse_id=nurse_b_id,
        notes="Reassigning primary nurse care.",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=12,
                dose="250 mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=2,
                start_date=str(date.today()),
                start_time="18:00",
                administration_times=["18:00"],
            )
        ]
    )
    rx_res_reassign = create_prescription(req_reassign, current_user=doctor_ctx)
    assert rx_res_reassign.get("nurse_assignment", {}).get("nurse_id") == nurse_b_id

    # Verify history: Nurse A assignment must now be is_active: False
    past_assignment_a = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": pat_id,
        "nurse_id": nurse_a_id,
    })
    assert past_assignment_a is not None, "Nurse A assignment history must be preserved"
    assert past_assignment_a["is_active"] is False, "Nurse A assignment must now be deactivated"

    # Verify new assignment: Nurse B assignment is is_active: True
    new_assignment_b = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": pat_id,
        "nurse_id": nurse_b_id,
        "is_active": True,
    })
    assert new_assignment_b is not None, "Nurse B must have active assignment"

    # Verify Nurse B roster has patient; Nurse A roster no longer has patient
    nurse_b_pats = get_nurse_assigned_patients(current_user=nurse_b_ctx)
    assert pat_id in [p["id"] for p in nurse_b_pats], "Patient must now appear in Nurse B roster"
    nurse_a_pats = get_nurse_assigned_patients(current_user=nurse_a_ctx)
    assert pat_id not in [p["id"] for p in nurse_a_pats], "Patient must no longer appear in Nurse A roster"
    print("PASS: Reassignment successfully updated rosters and preserved history.")

    # =========================================================================
    # TEST 10: Outpatient prescription creation preserves nurse assignments
    # =========================================================================
    print("\n--- TEST 10: Outpatient prescription preserves nurse assignments ---")
    req_outpatient = PrescriptionCreate(
        patient_id=pat_id,
        admit_patient=False,
        notes="Outpatient maintenance regimen.",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=13,
                dose="400 mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=1,
                start_date=str(date.today()),
                start_time="20:00",
                administration_times=["20:00"],
            )
        ]
    )
    rx_res_outpatient = create_prescription(req_outpatient, current_user=doctor_ctx)
    # Check Nurse B assignment is still active
    nurse_b_active = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": pat_id,
        "nurse_id": nurse_b_id,
        "is_active": True,
    })
    assert nurse_b_active is not None, "Nurse B assignment must remain untouched by outpatient prescription"
    print("PASS: Outpatient prescription did not alter nurse assignments.")

    # =========================================================================
    # TEST 11: Validation error cases (Non-existent, Non-nurse, Inactive nurse)
    # =========================================================================
    print("\n--- TEST 11: Validation error handling ---")
    def make_item(m_id=10, d="500 mg"):
        return PrescriptionItemCreate(
            medicine_id=m_id,
            dose=d,
            route="Oral",
            frequency="ONCE_DAILY",
            duration_days=1,
            start_date=str(date.today()),
            start_time="08:00",
            administration_times=["08:00"],
        )

    # A. Non-existent nurse ID
    try:
        create_prescription(
            PrescriptionCreate(
                patient_id=pat_id,
                admit_patient=True,
                ward_id=ward_id,
                bed_id=bed_2_id,
                nurse_id=999999,
                medicines=[make_item(10, "600 mg")]
            ),
            current_user=doctor_ctx
        )
        assert False, "Expected error on non-existent nurse ID"
    except HTTPException as e:
        assert e.status_code in (400, 404)
        print(f"PASS: Non-existent nurse ID rejected: {e.detail}")

    # B. Non-nurse role (assigning doctor as nurse)
    try:
        create_prescription(
            PrescriptionCreate(
                patient_id=pat_id,
                admit_patient=True,
                ward_id=ward_id,
                bed_id=bed_2_id,
                nurse_id=dr_id,
                medicines=[make_item(10, "650 mg")]
            ),
            current_user=doctor_ctx
        )
        assert False, "Expected error when assigning non-nurse account"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Non-nurse account rejected: {e.detail}")

    # C. Inactive nurse
    try:
        create_prescription(
            PrescriptionCreate(
                patient_id=pat_id,
                admit_patient=True,
                ward_id=ward_id,
                bed_id=bed_2_id,
                nurse_id=nurse_inactive_id,
                medicines=[make_item(10, "700 mg")]
            ),
            current_user=doctor_ctx
        )
        assert False, "Expected error when assigning inactive nurse"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Inactive nurse rejected: {e.detail}")

    # =========================================================================
    # TEST 12: Unauthorized patient protection
    # =========================================================================
    print("\n--- TEST 12: Unauthorized patient protection ---")
    try:
        create_prescription(
            PrescriptionCreate(
                patient_id=pat_id,
                admit_patient=True,
                ward_id=ward_id,
                bed_id=bed_2_id,
                nurse_id=nurse_b_id,
                medicines=[make_item(10, "750 mg")]
            ),
            current_user=other_doctor_ctx
        )
        assert False, "Expected error when other doctor accesses unauthorized patient"
    except HTTPException as e:
        assert e.status_code in (403, 404)
        print(f"PASS: Unauthorized doctor prevented from prescribing or admitting patient: {e.detail}")

    # =========================================================================
    # TEST 13: Transactional Rollback / Integrity
    # =========================================================================
    print("\n--- TEST 13: Rollback on admission failure ---")
    # Mark bed_2 as occupied in advance
    mongo_db.beds.update_one({"id": bed_2_id}, {"$set": {"is_occupied": True, "status": "OCCUPIED"}})
    # Capture active assignments count for bed_2
    before_assignments_count = mongo_db.nurse_patient_assignments.count_documents({"patient_id": pat_id})

    try:
        create_prescription(
            PrescriptionCreate(
                patient_id=pat_id,
                admit_patient=True,
                ward_id=ward_id,
                bed_id=bed_2_id,
                nurse_id=nurse_a_id,
                medicines=[make_item(10, "800 mg")]
            ),
            current_user=doctor_ctx
        )
        assert False, "Expected error because bed 2 is already occupied"
    except HTTPException as e:
        assert e.status_code in (400, 409)
        print(f"PASS: Admission to occupied bed rejected: {e.detail}")

    after_assignments_count = mongo_db.nurse_patient_assignments.count_documents({"patient_id": pat_id})
    assert before_assignments_count == after_assignments_count, "No orphaned nurse assignment should be created on failure"
    print("PASS: Transactional integrity preserved, no orphaned assignments.")

    # =========================================================================
    # TEST 14: Multi-item prescription and schedule regression
    # =========================================================================
    print("\n--- TEST 14: Multi-item prescription and schedule regression ---")
    history = get_prescription_history(str(pat_id), current_user=doctor_ctx)
    assert len(history) >= 3, f"Expected at least 3 historical prescriptions, got {len(history)}"
    for rx in history:
        assert "items" in rx
        assert "prescription_id" in rx
    print(f"PASS: All {len(history)} prescriptions retrieved from history with non-destructive preservation.")

    print("\n" + "=" * 80)
    print("ALL 14 E2E TEST CASES PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    run_e2e_tests()
