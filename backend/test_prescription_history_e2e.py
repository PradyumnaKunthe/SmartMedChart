"""
SmartMedChart - Comprehensive Prescription History & Non-Destructive Preservation Test Suite
Verifies all 10 mandatory requirements directly against the FastAPI route handlers and MongoDB:
1. Register a test patient.
2. Doctor creates prescription #1.
3. Verify prescription #1 exists in MongoDB prescriptions and prescription_items.
4. Doctor creates prescription #2 (different medicine) for the same patient.
5. Verify prescription #1 still exists in MongoDB unchanged with status ACTIVE.
6. Verify prescription #2 has a new unique prescription ID.
7. Query get_prescription_history: verify both prescriptions returned with full items.
8. Replace prescription #1 with a revised regimen: verify #1 is marked SUPERSEDED, unadministered doses cancelled, administered doses preserved.
9. Stop prescription #2: verify it is marked STOPPED while the record persists in history.
10. Verify patient isolation: another patient does not see these prescriptions.
"""

import sys
import os
from datetime import date, datetime, time
from types import SimpleNamespace
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes.doctor import (
    create_prescription,
    replace_prescription,
    get_prescription_history,
    get_current_medications,
    stop_prescription,
    next_mongo_id,
    mongo_now,
)
from app.schemas.prescription import PrescriptionCreate, PrescriptionItemCreate
from app.security import hash_password


def build_mock_user(user_doc):
    role_doc = mongo_db.roles.find_one({"$or": [{"_id": user_doc["role_id"]}, {"id": user_doc["role_id"]}]})
    role_name = role_doc.get("name", "Doctor") if role_doc else "Doctor"
    role_id = role_doc.get("id", user_doc["role_id"]) if role_doc else user_doc["role_id"]

    perms = list(mongo_db.permissions.find({}))
    perm_objects = [SimpleNamespace(name=p["name"]) for p in perms]

    return SimpleNamespace(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        role_id=role_id,
        role=SimpleNamespace(
            id=role_id,
            name=role_name,
            permissions=perm_objects,
        )
    )


def run_e2e_tests():
    print("=" * 75)
    print("STARTING E2E TEST: COMPLETE PATIENT PRESCRIPTION HISTORY PRESERVATION")
    print("=" * 75)

    # Setup test doctor user
    doctor_username = f"rx_test_dr_{int(datetime.utcnow().timestamp())}"
    doc_id = next_mongo_id("users")
    doc_user = {
        "_id": doc_id,
        "id": doc_id,
        "username": doctor_username,
        "email": f"{doctor_username}@smartmedchart.org",
        "hashed_password": hash_password("DoctorPass123!"),
        "full_name": "Dr. Sarah Mitchell",
        "role_id": 2,  # Doctor role
        "is_active": True,
        "created_at": mongo_now(),
        "updated_at": mongo_now(),
    }
    mongo_db.users.insert_one(doc_user)
    current_doctor = build_mock_user(doc_user)
    print(f"Created test doctor '{doctor_username}' (ID: {doc_id})")

    # Verify medicines exist (Paracetamol ID 10, Cetirizine ID 11)
    med1 = mongo_db.medicines.find_one({"id": 10})
    med2 = mongo_db.medicines.find_one({"id": 11})
    if not med1:
        med1 = {
            "_id": 10,
            "id": 10,
            "name": "PARACETAMOL",
            "generic_name": "PARACETAMOL",
            "brand_name": "DOLO",
            "strength": "500 MG",
            "dosage_form": "TABLET",
            "total_stock": 500,
            "is_active": 1,
        }
        mongo_db.medicines.insert_one(med1)
    if not med2:
        med2 = {
            "_id": 11,
            "id": 11,
            "name": "CETIRIZINE",
            "generic_name": "CETIRIZINE",
            "brand_name": "CETZINE",
            "strength": "10 MG",
            "dosage_form": "TABLET",
            "total_stock": 500,
            "is_active": 1,
        }
        mongo_db.medicines.insert_one(med2)

    # -------------------------------------------------------------
    # TEST CASE 1: Register a test patient with active encounter
    # -------------------------------------------------------------
    patient_a_id = next_mongo_id("patients")
    pat_code = f"PAT-TEST-{patient_a_id}"
    patient_a = {
        "_id": patient_a_id,
        "id": patient_a_id,
        "patient_id": pat_code,
        "first_name": "David",
        "last_name": "Miller",
        "date_of_birth": "1985-06-15",
        "gender": "male",
        "weight_kg": 72.5,
        "is_active": True,
        "lifecycle_status": "ADMITTED",
        "created_at": mongo_now(),
        "updated_at": mongo_now(),
    }
    mongo_db.patients.insert_one(patient_a)

    encounter_a_id = next_mongo_id("encounters")
    encounter_a = {
        "_id": encounter_a_id,
        "id": encounter_a_id,
        "patient_id": patient_a_id,
        "doctor_id": doc_id,
        "encounter_type": "INPATIENT",
        "status": "ACTIVE",
        "admission_date": mongo_now(),
        "created_at": mongo_now(),
        "updated_at": mongo_now(),
    }
    mongo_db.encounters.insert_one(encounter_a)
    print(f"[TC 1 PASSED] Registered test patient A (ID: {patient_a_id}, Code: {pat_code}) assigned to Doctor {doc_id}")

    # -------------------------------------------------------------
    # TEST CASE 2 & 3: Doctor creates prescription #1
    # -------------------------------------------------------------
    today_d = date.today()
    req1 = PrescriptionCreate(
        patient_id=patient_a_id,
        notes="Initial analgesia for mild fever",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=10,
                dose="500mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=today_d,
                start_time=time(8, 0),
                administration_times=["08:00"],
                instructions="Take after breakfast with water",
            )
        ],
    )

    resp1 = create_prescription(request=req1, current_user=current_doctor)
    rx1_id = resp1["prescription_id"]
    assert rx1_id > 0, "Invalid rx1_id"
    print(f"[TC 2 PASSED] Doctor created Prescription #1 (ID: {rx1_id})")

    # Verify Rx #1 in MongoDB
    rx1_doc = mongo_db.prescriptions.find_one({"_id": rx1_id})
    assert rx1_doc is not None, "Rx #1 document not found in MongoDB"
    assert rx1_doc["status"] == "ACTIVE", f"Expected ACTIVE, got {rx1_doc['status']}"
    assert rx1_doc["patient_id"] == patient_a_id
    assert rx1_doc["doctor_id"] == doc_id
    rx1_items = list(mongo_db.prescription_items.find({"prescription_id": rx1_id}))
    assert len(rx1_items) == 1, f"Expected 1 item, got {len(rx1_items)}"
    assert rx1_items[0]["medicine_id"] == 10
    assert rx1_items[0]["dose"] == "500mg"
    assert rx1_items[0]["status"] == "ACTIVE"
    print(f"[TC 3 PASSED] Verified Prescription #1 persisted in MongoDB 'prescriptions' and 'prescription_items'")

    # -------------------------------------------------------------
    # TEST CASE 4: Doctor creates prescription #2 (different medicine)
    # -------------------------------------------------------------
    req2 = PrescriptionCreate(
        patient_id=patient_a_id,
        notes="Allergy relief regimen",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=11,
                dose="10mg",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=5,
                start_date=today_d,
                start_time=time(20, 0),
                administration_times=["20:00"],
                instructions="Take at bedtime",
            )
        ],
    )

    resp2 = create_prescription(request=req2, current_user=current_doctor)
    rx2_id = resp2["prescription_id"]
    print(f"[TC 4 PASSED] Doctor created Prescription #2 (ID: {rx2_id})")

    # -------------------------------------------------------------
    # TEST CASE 5: Verify Prescription #1 still exists unchanged with status ACTIVE
    # -------------------------------------------------------------
    rx1_doc_after = mongo_db.prescriptions.find_one({"_id": rx1_id})
    assert rx1_doc_after is not None, "Prescription #1 was deleted after creating Rx #2!"
    assert rx1_doc_after["status"] == "ACTIVE", f"Rx #1 status was changed to {rx1_doc_after['status']}"
    assert rx1_doc_after["notes"] == "Initial analgesia for mild fever"
    print(f"[TC 5 PASSED] Verified Prescription #1 is completely preserved and still ACTIVE after creating Prescription #2")

    # -------------------------------------------------------------
    # TEST CASE 6: Verify Prescription #2 has a new unique ID
    # -------------------------------------------------------------
    assert rx2_id != rx1_id, f"Rx #2 overwrote Rx #1 ID! ({rx2_id} == {rx1_id})"
    rx2_doc = mongo_db.prescriptions.find_one({"_id": rx2_id})
    assert rx2_doc is not None, "Rx #2 not found in MongoDB"
    assert rx2_doc["status"] == "ACTIVE"
    rx2_items = list(mongo_db.prescription_items.find({"prescription_id": rx2_id}))
    assert len(rx2_items) == 1
    assert rx2_items[0]["medicine_id"] == 11
    print(f"[TC 6 PASSED] Verified Prescription #2 has distinct unique ID {rx2_id} and separate prescription_items")

    # -------------------------------------------------------------
    # TEST CASE 7: Query prescription history API
    # -------------------------------------------------------------
    history_data = get_prescription_history(patient_id=str(patient_a_id), current_user=current_doctor)
    assert len(history_data) >= 2, f"Expected at least 2 prescriptions in history, got {len(history_data)}"

    found_rx_ids = [r["prescription_id"] for r in history_data]
    assert rx1_id in found_rx_ids, f"Rx #1 ({rx1_id}) missing from history response!"
    assert rx2_id in found_rx_ids, f"Rx #2 ({rx2_id}) missing from history response!"

    # Verify newest first sorting
    rx2_idx = found_rx_ids.index(rx2_id)
    rx1_idx = found_rx_ids.index(rx1_id)
    assert rx2_idx < rx1_idx, "Prescriptions are not sorted newest first!"

    # Check complete details and items
    rx1_hist = next(r for r in history_data if r["prescription_id"] == rx1_id)
    assert rx1_hist["doctor_name"] == "Dr. Sarah Mitchell", f"Unexpected doctor_name: {rx1_hist['doctor_name']}"
    assert rx1_hist["status"] == "ACTIVE"
    assert len(rx1_hist["items"]) == 1
    assert rx1_hist["items"][0]["medicine_name"] == "PARACETAMOL"
    assert rx1_hist["items"][0]["dose"] == "500mg"

    # Also verify current-medications returns both active medications
    curr_meds = get_current_medications(patient_id=str(patient_a_id), current_user=current_doctor)
    curr_med_names = [m["medicine_name"] for m in curr_meds]
    assert "PARACETAMOL" in curr_med_names
    assert "CETIRIZINE" in curr_med_names
    print(f"[TC 7 PASSED] get_prescription_history returned both grouped orders sorted newest first with complete items")

    # -------------------------------------------------------------
    # TEST CASE 8: Replace prescription #1 with revised regimen
    # -------------------------------------------------------------
    # Before replacement, simulate that Dose 1 of Rx #1 was already administered by a nurse
    rx1_schedules = list(mongo_db.medication_schedules.find({"prescription_id": rx1_id}).sort("id", 1))
    assert len(rx1_schedules) > 0, "No schedules found for Rx #1"
    first_sched_id = rx1_schedules[0]["id"]
    mongo_db.medication_schedules.update_one(
        {"_id": first_sched_id},
        {"$set": {
            "status": "ADMINISTERED",
            "actual_administration_time": mongo_now(),
            "notes": "Administered by nurse on duty",
        }}
    )

    # Doctor replaces Rx #1 with increased dose of Paracetamol (650mg, BID for 4 days)
    req3 = PrescriptionCreate(
        patient_id=patient_a_id,
        replaces_prescription_id=rx1_id,
        notes="Replacement regimen: escalated dose due to persistent fever",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=10,
                dose="650mg",
                route="Oral",
                frequency="TWICE_DAILY",
                duration_days=4,
                start_date=today_d,
                start_time=time(8, 0),
                administration_times=["08:00", "20:00"],
                instructions="Take after meals",
            )
        ],
    )

    resp3 = replace_prescription(prescription_id=rx1_id, request=req3, current_user=current_doctor)
    rx3_id = resp3["prescription_id"]
    assert rx3_id != rx1_id and rx3_id != rx2_id
    assert resp3.get("replaces_prescription_id") == rx1_id

    # Verify old prescription #1 is marked SUPERSEDED
    rx1_doc_superseded = mongo_db.prescriptions.find_one({"_id": rx1_id})
    assert rx1_doc_superseded["status"] == "SUPERSEDED", f"Expected SUPERSEDED, got {rx1_doc_superseded['status']}"
    assert rx1_doc_superseded["superseded_by"] == rx3_id

    # Verify old prescription item is marked SUPERSEDED
    rx1_item_superseded = mongo_db.prescription_items.find_one({"prescription_id": rx1_id})
    assert rx1_item_superseded["status"] == "SUPERSEDED"

    # Verify administered dose is STRICTLY PRESERVED
    sched1_check = mongo_db.medication_schedules.find_one({"_id": first_sched_id})
    assert sched1_check is not None, "Administered schedule was erroneously deleted!"
    assert sched1_check["status"] == "ADMINISTERED", f"Administered schedule status corrupted: {sched1_check['status']}"
    assert sched1_check["actual_administration_time"] is not None

    # Verify unadministered future doses of Rx #1 were cancelled or removed
    other_rx1_schedules = list(mongo_db.medication_schedules.find({
        "prescription_id": rx1_id,
        "_id": {"$ne": first_sched_id},
    }))
    for s in other_rx1_schedules:
        assert s.get("status") in ("CANCELLED", "STOPPED"), f"Unadministered schedule not cancelled: {s.get('status')}"

    print(f"[TC 8 PASSED] Replaced Prescription #1 with #3: #1 marked SUPERSEDED (superseded_by: {rx3_id}), administered dose preserved, unadministered doses cancelled")

    # -------------------------------------------------------------
    # TEST CASE 9: Stop prescription #2
    # -------------------------------------------------------------
    stop_resp = stop_prescription(prescription_id=rx2_id, current_user=current_doctor)
    assert stop_resp["status"] == "STOPPED"

    rx2_doc_stopped = mongo_db.prescriptions.find_one({"_id": rx2_id})
    assert rx2_doc_stopped["status"] == "STOPPED", f"Expected STOPPED, got {rx2_doc_stopped['status']}"

    rx2_item_stopped = mongo_db.prescription_items.find_one({"prescription_id": rx2_id})
    assert rx2_item_stopped["status"] == "STOPPED"

    # Verify full history now returns all 3 prescriptions with appropriate statuses
    all_history = get_prescription_history(patient_id=str(patient_a_id), current_user=current_doctor)
    statuses_by_id = {r["prescription_id"]: r["status"] for r in all_history}
    assert statuses_by_id.get(rx1_id) == "SUPERSEDED", f"Rx #1 status mismatch in history: {statuses_by_id.get(rx1_id)}"
    assert statuses_by_id.get(rx2_id) == "STOPPED", f"Rx #2 status mismatch in history: {statuses_by_id.get(rx2_id)}"
    assert statuses_by_id.get(rx3_id) == "ACTIVE", f"Rx #3 status mismatch in history: {statuses_by_id.get(rx3_id)}"

    # Verify current medications ONLY returns the active regimen (Rx #3)
    curr_meds2 = get_current_medications(patient_id=str(patient_a_id), current_user=current_doctor)
    assert len(curr_meds2) == 1, f"Expected exactly 1 active medication, got {len(curr_meds2)}"
    assert curr_meds2[0]["prescription_id"] == rx3_id
    assert curr_meds2[0]["dose"] == "650mg"
    print(f"[TC 9 PASSED] Stopped Prescription #2: marked STOPPED, complete history retains all 3 orders, current-medications returns ONLY active #3")

    # -------------------------------------------------------------
    # TEST CASE 10: Verify patient isolation
    # -------------------------------------------------------------
    patient_b_id = next_mongo_id("patients")
    pat_b_code = f"PAT-ISOLATION-{patient_b_id}"
    patient_b = {
        "_id": patient_b_id,
        "id": patient_b_id,
        "patient_id": pat_b_code,
        "first_name": "Emma",
        "last_name": "Watson",
        "date_of_birth": "1992-04-20",
        "gender": "female",
        "weight_kg": 58.0,
        "is_active": True,
        "lifecycle_status": "ADMITTED",
        "created_at": mongo_now(),
        "updated_at": mongo_now(),
    }
    mongo_db.patients.insert_one(patient_b)

    encounter_b_id = next_mongo_id("encounters")
    encounter_b = {
        "_id": encounter_b_id,
        "id": encounter_b_id,
        "patient_id": patient_b_id,
        "doctor_id": doc_id,
        "encounter_type": "INPATIENT",
        "status": "ACTIVE",
        "admission_date": mongo_now(),
        "created_at": mongo_now(),
        "updated_at": mongo_now(),
    }
    mongo_db.encounters.insert_one(encounter_b)

    # Patient B history must be empty
    pat_b_history = get_prescription_history(patient_id=str(patient_b_id), current_user=current_doctor)
    assert len(pat_b_history) == 0, f"Patient B saw Patient A's prescriptions! {pat_b_history}"

    pat_b_meds = get_current_medications(patient_id=str(patient_b_id), current_user=current_doctor)
    assert len(pat_b_meds) == 0, f"Patient B saw Patient A's medications! {pat_b_meds}"

    print(f"[TC 10 PASSED] Patient isolation confirmed: Patient B does not see any prescriptions of Patient A")

    print("\n" + "=" * 75)
    print("ALL 10 MANDATORY TEST CASES PASSED SUCCESSFULLY (100% PASS RATE)!")
    print("=" * 75)


if __name__ == "__main__":
    run_e2e_tests()
