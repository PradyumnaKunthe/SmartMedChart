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
from app.routes import hospital as hospital_routes
from app.routes import carematch as carematch_routes
from app.schemas.prescription import PrescriptionCreate


def make_user(role_name: str, user_id: int, username: str, permission_names: list[str]):
    perms = [SimpleNamespace(name=p) for p in permission_names]
    role = SimpleNamespace(
        id=1 if role_name == "Doctor" else (2 if role_name == "Nurse" else (3 if role_name == "Receptionist" else 4)),
        name=role_name,
        permissions=perms
    )
    return SimpleNamespace(id=user_id, username=username, full_name=f"{username.capitalize()}", role=role)


def run_tests():
    print("=" * 80)
    print("SMARTMEDCHART E2E VERIFICATION SUITE")
    print("BUG 1: Discharged Patient Visibility Application-Wide")
    print("BUG 2: Doctor Prescription Creation & Error Handling")
    print("Target Database:", mongo_db.name)
    print("=" * 80)

    # Safety assertion
    assert mongo_db.name == "smartmedchart_e2e_test", "CRITICAL SAFETY HALT: Must run on smartmedchart_e2e_test only!"

    # 1. Setup Test Users
    db_doctor = mongo_db.users.find_one({"role_id": 1}) or mongo_db.users.find_one({"username": {"$regex": "doc", "$options": "i"}})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})
    db_nurse = mongo_db.users.find_one({"role_id": 2}) or mongo_db.users.find_one({"username": {"$regex": "nurse", "$options": "i"}})
    db_receptionist = mongo_db.users.find_one({"role_id": 3}) or mongo_db.users.find_one({"username": {"$regex": "recep", "$options": "i"}})

    assert db_doctor, "Doctor user must exist in test DB"
    assert db_admin, "Admin user must exist in test DB"
    assert db_nurse, "Nurse user must exist in test DB"

    doctor_user = make_user("Doctor", db_doctor["id"], db_doctor["username"], [
        "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "STOP_PRESCRIPTION", "VIEW_MEDICATION_SCHEDULE"
    ])
    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], [
        "MANAGE_SYSTEM", "MANAGE_USERS", "VIEW_PATIENT", "EDIT_PATIENT", "MANAGE_INVENTORY"
    ])
    nurse_user = make_user("Nurse", db_nurse["id"], db_nurse["username"], [
        "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "ADMINISTER_MEDICATION"
    ])
    recep_user = make_user("Receptionist", db_receptionist["id"] if db_receptionist else 301, "receptionist", [
        "VIEW_PATIENT", "REGISTER_PATIENT"
    ])

    print(f"[AUTH] Doctor: {doctor_user.username} (ID: {doctor_user.id})")
    print(f"[AUTH] Admin: {admin_user.username} (ID: {admin_user.id})")
    print(f"[AUTH] Nurse: {nurse_user.username} (ID: {nurse_user.id})")
    print(f"[AUTH] Receptionist: {recep_user.username} (ID: {recep_user.id})")

    now = datetime.utcnow().isoformat(timespec="microseconds")

    # Ensure test formulary medicine exists with initial stock
    med = mongo_db.medicines.find_one({"is_active": {"$in": [True, 1]}, "is_archived": {"$ne": True}})
    if not med:
        med_id = 9101
        mongo_db.medicines.insert_one({
            "_id": med_id,
            "id": med_id,
            "name": "AMOXICILLIN 500MG",
            "generic_name": "Amoxicillin Trihydrate",
            "strength": "500 mg",
            "dosage_form": "CAPSULE",
            "unit": "CAPSULE",
            "total_stock": 250,
            "is_active": True,
            "is_archived": False,
            "is_test": False,
            "created_at": now,
            "updated_at": now,
        })
        med = mongo_db.medicines.find_one({"_id": med_id})

    initial_stock = int(med.get("total_stock", 0))

    # Ensure test ward & beds exist
    ward = mongo_db.wards.find_one({"is_active": {"$in": [True, 1]}})
    if not ward:
        ward_id = 801
        mongo_db.wards.insert_one({
            "_id": ward_id,
            "id": ward_id,
            "name": "Medical Inpatient Ward",
            "code": "MED-A",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })
        ward = mongo_db.wards.find_one({"_id": ward_id})

    # Find or create 2 beds
    bed_a = mongo_db.beds.find_one({"ward_id": ward["id"], "is_active": {"$in": [True, 1]}, "is_occupied": {"$in": [False, 0]}})
    if not bed_a:
        bed_id = 8101
        mongo_db.beds.insert_one({
            "_id": bed_id,
            "id": bed_id,
            "ward_id": ward["id"],
            "bed_number": "MED-101",
            "is_active": True,
            "is_occupied": 0,
            "occupied_by_patient_id": None,
            "created_at": now,
            "updated_at": now,
        })
        bed_a = mongo_db.beds.find_one({"_id": bed_id})

    bed_b = mongo_db.beds.find_one({"ward_id": ward["id"], "_id": {"$ne": bed_a["_id"]}, "is_active": {"$in": [True, 1]}})
    if not bed_b:
        bed_id = 8102
        mongo_db.beds.insert_one({
            "_id": bed_id,
            "id": bed_id,
            "ward_id": ward["id"],
            "bed_number": "MED-102",
            "is_active": True,
            "is_occupied": 0,
            "occupied_by_patient_id": None,
            "created_at": now,
            "updated_at": now,
        })
        bed_b = mongo_db.beds.find_one({"_id": bed_id})

    # =========================================================================
    # TEST 1: SETUP TEST PATIENTS A & B
    # =========================================================================
    print("\n--- TEST 1: Register Inpatient A and Inpatient B ---")
    pid_a = 7001
    mongo_db.patients.delete_many({"_id": {"$in": [7001, 7002]}})
    mongo_db.encounters.delete_many({"patient_id": {"$in": [7001, 7002]}})
    mongo_db.prescriptions.delete_many({"patient_id": {"$in": [7001, 7002]}})
    mongo_db.patient_billing.delete_many({"patient_id": {"$in": [7001, 7002]}})
    mongo_db.nurse_patient_assignments.delete_many({"patient_id": {"$in": [7001, 7002]}})

    # Patient A (will be prescribed, admitted, then discharged)
    patient_a = {
        "_id": pid_a,
        "id": pid_a,
        "patient_id": "PAT-7001",
        "first_name": "ARUN",
        "last_name": "SHARMA",
        "gender": "Male",
        "date_of_birth": "1988-04-12",
        "weight_kg": 72.5,
        "mobile_number": "9876543210",
        "ward_id": ward["id"],
        "bed_id": bed_a["id"],
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "qr_token": "QR-TOKEN-PAT-7001",
        "qr_is_active": True,
        "qr_generated_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.patients.insert_one(patient_a)

    encounter_a = {
        "_id": 7101,
        "id": 7101,
        "patient_id": pid_a,
        "doctor_id": doctor_user.id,
        "encounter_type": "INPATIENT",
        "status": "ACTIVE",
        "chief_complaint": "ACUTE BRONCHITIS",
        "admitted_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.encounters.insert_one(encounter_a)

    billing_a = {
        "_id": 7201,
        "id": 7201,
        "patient_id": pid_a,
        "bill_status": "PENDING",
        "bill_amount": 1500.0,
        "paid_at": None,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.patient_billing.insert_one(billing_a)

    assignment_a = {
        "_id": 7301,
        "id": 7301,
        "patient_id": pid_a,
        "nurse_id": nurse_user.id,
        "is_active": True,
        "status": "ACTIVE",
        "assigned_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.nurse_patient_assignments.insert_one(assignment_a)

    # Mark bed_a as occupied by patient A
    mongo_db.beds.update_one({"_id": bed_a["id"]}, {"$set": {"is_occupied": 1, "occupied_by_patient_id": pid_a}})

    # Patient B (will remain ACTIVE throughout test)
    pid_b = 7002
    patient_b = {
        "_id": pid_b,
        "id": pid_b,
        "patient_id": "PAT-7002",
        "first_name": "PRIYA",
        "last_name": "PATEL",
        "gender": "Female",
        "date_of_birth": "1994-09-25",
        "weight_kg": 58.0,
        "mobile_number": "9123456780",
        "ward_id": ward["id"],
        "bed_id": bed_b["id"],
        "is_active": True,
        "lifecycle_status": "ACTIVE",
        "qr_token": "QR-TOKEN-PAT-7002",
        "qr_is_active": True,
        "qr_generated_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.patients.insert_one(patient_b)

    encounter_b = {
        "_id": 7102,
        "id": 7102,
        "patient_id": pid_b,
        "doctor_id": doctor_user.id,
        "encounter_type": "INPATIENT",
        "status": "ACTIVE",
        "chief_complaint": "POST-OPERATIVE MONITORING",
        "admitted_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.encounters.insert_one(encounter_b)

    billing_b = {
        "_id": 7202,
        "id": 7202,
        "patient_id": pid_b,
        "bill_status": "PENDING",
        "bill_amount": 2500.0,
        "paid_at": None,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.patient_billing.insert_one(billing_b)

    assignment_b = {
        "_id": 7302,
        "id": 7302,
        "patient_id": pid_b,
        "nurse_id": nurse_user.id,
        "is_active": True,
        "status": "ACTIVE",
        "assigned_at": now,
        "created_at": now,
        "updated_at": now,
    }
    mongo_db.nurse_patient_assignments.insert_one(assignment_b)
    mongo_db.beds.update_one({"_id": bed_b["id"]}, {"$set": {"is_occupied": 1, "occupied_by_patient_id": pid_b}})

    print("[PASS] Test patients A (ARUN SHARMA) and B (PRIYA PATEL) established in test database.")

    # =========================================================================
    # TEST 2: WRITE PRESCRIPTION FOR ACTIVE PATIENT A (DOCTOR ROLE)
    # =========================================================================
    print("\n--- TEST 2: Write Prescription for Active Patient A ---")
    rx_request = PrescriptionCreate(
        patient_id=pid_a,
        medicine_id=med["id"],
        dose="500 mg",
        route="Oral",
        frequency="TWICE_DAILY",
        duration_days=3,
        start_date=date.today(),
        start_time=time(8, 0),
        is_stat=False,
        instructions="Take with water after meals",
        notes="Clinical trial prescription",
    )

    rx_res = doctor_routes.create_prescription(rx_request, current_user=doctor_user)
    assert rx_res["patient_id"] == pid_a
    assert rx_res["schedule_count"] == 6  # 3 days * 2 doses/day
    rx_id_a = rx_res["prescription_id"]
    print(f"[PASS] Prescription #{rx_id_a} successfully authorized with 6 schedules.")

    # Verify zero pharmacy inventory deducted on creation
    med_after_create = mongo_db.medicines.find_one({"_id": med["id"]})
    assert int(med_after_create.get("total_stock", 0)) == initial_stock, "Inventory MUST NOT be deducted on prescription creation!"
    print(f"[PASS] Zero inventory deduction confirmed: stock remains {initial_stock}.")

    # Verify duplicate prescription check
    try:
        doctor_routes.create_prescription(rx_request, current_user=doctor_user)
        assert False, "Expected 409 Duplicate Prescription error!"
    except HTTPException as e:
        assert e.status_code == 409
        print(f"[PASS] Duplicate prescription blocked with HTTP 409: {e.detail}")

    # =========================================================================
    # TEST 3: DISCHARGE PATIENT A VIA ADMIN LIFECYCLE
    # =========================================================================
    print("\n--- TEST 3: Discharge Patient A ---")
    # Mark bill paid
    admin_routes.mark_patient_bill_paid(pid_a, current_user=admin_user)

    # Discharge patient A
    discharge_res = admin_routes.discharge_patient(
        patient_id=pid_a,
        request={"discharge_reason": "Treatment successfully completed"},
        current_user=admin_user
    )
    assert discharge_res["patient"]["is_active"] is False
    print("[PASS] Patient A discharged successfully.")

    # Verify MongoDB state for discharged Patient A
    doc_a = mongo_db.patients.find_one({"_id": pid_a})
    assert doc_a["is_active"] is False
    assert doc_a["lifecycle_status"] == "DISCHARGED"
    assert doc_a["bed_id"] is None
    assert doc_a["discharge_reason"] == "Treatment successfully completed"

    # Verify bed_a is released
    bed_a_doc = mongo_db.beds.find_one({"_id": bed_a["id"]})
    assert bed_a_doc["is_occupied"] in (0, False)
    assert bed_a_doc["occupied_by_patient_id"] is None
    print("[PASS] Bed assignment released and cleared in database.")

    # Verify active prescriptions closed
    rx_a_doc = mongo_db.prescriptions.find_one({"_id": rx_id_a})
    assert rx_a_doc["status"] == "DISCHARGED"
    print("[PASS] Active prescriptions closed with status DISCHARGED.")

    # Verify schedules cancelled
    cancelled_count = mongo_db.medication_schedules.count_documents({
        "prescription_item_id": {"$in": mongo_db.prescription_items.distinct("_id", {"prescription_id": rx_id_a})},
        "status": "CANCELLED"
    })
    assert cancelled_count == 6
    print(f"[PASS] All {cancelled_count} medication schedules cancelled upon discharge.")

    # =========================================================================
    # TEST 4: APPLICATION-WIDE VISIBILITY RULES (BUG 1)
    # =========================================================================
    print("\n--- TEST 4: Verify Discharged Patient Visibility Application-Wide ---")

    # A. Receptionist / Hospital Dashboard
    hosp_res = hospital_routes.get_hospital_patients(active_only=True, current_user=recep_user)
    hosp_patient_ids = [p["id"] for p in hosp_res["patients"]]
    assert pid_a not in hosp_patient_ids, "Discharged Patient A MUST NOT appear in Receptionist/Hospital /patients!"
    assert pid_b in hosp_patient_ids, "Active Patient B MUST appear in Receptionist/Hospital /patients!"
    print("[PASS] Receptionist /api/hospital/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.")

    hosp_dash = hospital_routes.get_hospital_dashboard(current_user=recep_user)
    assert hosp_dash["patients"]["inactive"] == 0, "Hospital dashboard must not expose inactive counts to receptionists!"
    print("[PASS] Receptionist /api/hospital/dashboard: Counts only active inpatients.")

    # B. Doctor Dashboard & Patients List
    doc_pts = doctor_routes.search_patients(search=None, current_user=doctor_user)
    doc_pt_ids = [p["id"] if isinstance(p, dict) else p.id for p in doc_pts]
    assert pid_a not in doc_pt_ids, "Discharged Patient A MUST NOT appear in Doctor /patients!"
    assert pid_b in doc_pt_ids, "Active Patient B MUST appear in Doctor /patients!"
    print("[PASS] Doctor /api/doctor/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.")

    # C. Doctor On-Round Patients
    round_pts = doctor_routes.get_doctor_round_patients(current_user=doctor_user)
    round_pt_ids = [p["id"] for p in round_pts]
    assert pid_a not in round_pt_ids, "Discharged Patient A MUST NOT appear in Doctor Ward Rounds!"
    assert pid_b in round_pt_ids, "Active Patient B MUST appear in Doctor Ward Rounds!"
    print("[PASS] Doctor /api/doctor/rounds/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.")

    # D. Nurse Assigned Patients
    nurse_pts = nurse_routes.get_nurse_assigned_patients(current_user=nurse_user)
    nurse_pt_ids = [p["id"] for p in nurse_pts]
    assert pid_a not in nurse_pt_ids, "Discharged Patient A MUST NOT appear in Nurse /patients!"
    assert pid_b in nurse_pt_ids, "Active Patient B MUST appear in Nurse /patients!"
    print("[PASS] Nurse /api/nurse/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.")

    # E. Nurse Medication Administration Queue
    nurse_meds = nurse_routes.get_nurse_medications(current_user=nurse_user)
    med_queue_pids = [m["patient_id"] for m in nurse_meds]
    assert pid_a not in med_queue_pids, "Discharged Patient A schedules MUST NOT appear in Nurse Medication Queue!"
    print("[PASS] Nurse /api/nurse/medications: Discharged Patient A schedules completely absent from queue.")

    # F. Nurse Bedside Details
    try:
        nurse_routes.get_nurse_patient_details(pid_a, current_user=nurse_user)
        assert False, "Expected 404 for discharged patient in get_nurse_patient_details"
    except HTTPException as e:
        assert e.status_code == 404
        print(f"[PASS] Nurse /api/nurse/patients/{pid_a} rejected with HTTP 404: {e.detail}")

    # G. CareMatch Appointment Booking
    try:
        carematch_routes.save_carematch_appointment({
            "patient_id": pid_a,
            "encounter_id": 7101,
            "doctor_id": doctor_user.id,
            "visit_reason": "Follow-up consultation",
            "appointment_date": (date.today() + timedelta(days=2)).isoformat(),
            "appointment_time": "10:30",
        }, current_user=recep_user)
        assert False, "Expected 400 for CareMatch appointment booking on discharged patient"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"[PASS] CareMatch appointment booking for discharged patient blocked with HTTP 400: {e.detail}")

    # H. Admin Active Patients & Assignments
    admin_pts = admin_routes.get_patients(current_user=admin_user)
    admin_pt_ids = [p["id"] for p in admin_pts["patients"]]
    assert pid_a not in admin_pt_ids, "Discharged Patient A MUST NOT appear in Admin Active Patients list!"
    assert pid_b in admin_pt_ids, "Active Patient B MUST appear in Admin Active Patients list!"
    print("[PASS] Admin /api/admin/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.")

    admin_assigns = admin_routes.get_assignments(current_user=admin_user)
    assign_list = admin_assigns["assignments"] if isinstance(admin_assigns, dict) else admin_assigns
    assign_pids = [a["patient_id"] for a in assign_list]
    assert pid_a not in assign_pids, "Discharged Patient A MUST NOT appear in Admin active staff assignments!"
    assert pid_b in assign_pids, "Active Patient B MUST appear in Admin active staff assignments!"
    print("[PASS] Admin /api/admin/assignments: Discharged Patient A HIDDEN from active assignments.")

    # I. Admin Discharged Patients Endpoint (Dedicated Exclusive Endpoint)
    discharged_res = admin_routes.get_discharged_patients(current_user=admin_user)
    discharged_ids = [p["id"] for p in discharged_res["discharged"]]
    assert pid_a in discharged_ids, "Discharged Patient A MUST appear in Admin Discharged Patients endpoint!"
    assert pid_b not in discharged_ids, "Active Patient B MUST NOT appear in Admin Discharged Patients endpoint!"
    print(f"[PASS] Admin /api/admin/patients/discharged: Exclusively lists {discharged_res['count']} discharged patient(s) including Patient A.")

    # J. Admin Patient Lifecycle (Tab Separation)
    lifecycle_res = admin_routes.get_patient_lifecycle(current_user=admin_user)
    active_lifecycle_ids = [p["id"] for p in lifecycle_res["active"]]
    discharged_lifecycle_ids = [p["id"] for p in lifecycle_res["discharged"]]
    assert pid_a not in active_lifecycle_ids, "Discharged Patient A MUST NOT appear in lifecycle active list!"
    assert pid_a in discharged_lifecycle_ids, "Discharged Patient A MUST appear in lifecycle discharged list!"
    assert pid_b in active_lifecycle_ids, "Active Patient B MUST appear in lifecycle active list!"
    assert pid_b not in discharged_lifecycle_ids, "Active Patient B MUST NOT appear in lifecycle discharged list!"
    print("[PASS] Admin /api/admin/patients/lifecycle: Strict separation verified (Active: Patient B, Discharged: Patient A).")

    # =========================================================================
    # TEST 5: DOCTOR PRESCRIPTION WORKFLOW & ERROR REJECTION (BUG 2)
    # =========================================================================
    print("\n--- TEST 5: Verify Prescription Creation and Error Handling (BUG 2) ---")

    # A. Attempting to write prescription for discharged patient A must fail with 400
    try:
        doctor_routes.create_prescription(
            PrescriptionCreate(
                patient_id=pid_a,
                medicine_id=med["id"],
                dose="500 mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=5,
                start_date=date.today(),
                start_time=time(9, 0),
            ),
            current_user=doctor_user
        )
        assert False, "Expected 400 rejection when writing prescription for discharged patient!"
    except HTTPException as e:
        assert e.status_code == 400
        assert "Cannot create prescription for a discharged patient" in str(e.detail)
        print(f"[PASS] Prescribing for discharged patient A rejected with HTTP 400: '{e.detail}'.")

    # B. Historical Prescription Retrieval for Discharged Patient A
    history_res = doctor_routes.get_prescription_history(pid_a, current_user=doctor_user)
    assert len(history_res) >= 1
    assert history_res[0]["prescription_id"] == rx_id_a
    print(f"[PASS] Historical prescriptions for discharged Patient A preserved and readable (Found {len(history_res)} records).")

    # C. Write Prescription for Active Patient B
    rx_b_req = PrescriptionCreate(
        patient_id=pid_b,
        medicine_id=med["id"],
        dose="250 mg",
        route="Oral",
        frequency="ONCE_DAILY",
        duration_days=5,
        start_date=date.today(),
        start_time=time(10, 0),
        instructions="Once daily morning dose",
    )
    rx_b_res = doctor_routes.create_prescription(rx_b_req, current_user=doctor_user)
    assert rx_b_res["patient_id"] == pid_b
    assert rx_b_res["schedule_count"] == 5
    rx_id_b = rx_b_res["prescription_id"]
    print(f"[PASS] Successfully wrote prescription #{rx_id_b} for Active Patient B with 5 schedules.")

    # =========================================================================
    # TEST 6: HISTORICAL DATA INTEGRITY (MONGODB DATA RETENTION)
    # =========================================================================
    print("\n--- TEST 6: Verify MongoDB Data Preservation ---")
    assert mongo_db.patients.find_one({"_id": pid_a}) is not None, "Patient A document must remain in MongoDB!"
    assert mongo_db.encounters.find_one({"patient_id": pid_a}) is not None, "Patient A encounters must remain in MongoDB!"
    assert mongo_db.prescriptions.find_one({"_id": rx_id_a}) is not None, "Prescription #{rx_id_a} must remain in MongoDB!"
    assert mongo_db.patient_billing.find_one({"patient_id": pid_a}) is not None, "Patient A billing must remain in MongoDB!"
    assert mongo_db.nurse_patient_assignments.find_one({"patient_id": pid_a}) is not None, "Patient A assignments must remain in MongoDB!"
    print("[PASS] Full clinical history, prescriptions, encounters, schedules, and billing preserved in MongoDB without deletion.")

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED: 100% SUCCESS (BUG 1 & BUG 2 RESOLVED)")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
