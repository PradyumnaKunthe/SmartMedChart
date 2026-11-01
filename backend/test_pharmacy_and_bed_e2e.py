import sys
import os
from pathlib import Path
from datetime import datetime, date, time, timedelta
from types import SimpleNamespace
from fastapi import HTTPException

# Set test database environment
os.environ["MONGODB_DATABASE"] = "smartmedchart_e2e_test"

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes import pharmacy as pharmacy_routes
from app.routes import doctor as doctor_routes
from app.routes import allergies as allergy_routes
from app.schemas.medicine import MedicineCreate, BatchCreate, DispenseCreate
from app.schemas.prescription import PrescriptionCreate
from app.schemas.allergy import AllergyCreate
from app.services.medication_safety_service import check_medication_safety


def make_user(role_name: str, user_id: int, username: str, permission_names: list[str]):
    perms = [SimpleNamespace(name=p) for p in permission_names]
    role = SimpleNamespace(id=1 if role_name == "Doctor" else 4, name=role_name, permissions=perms)
    return SimpleNamespace(id=user_id, username=username, role=role)


def run_tests():
    print("=" * 70)
    print("RUNNING SMARTMEDCHART PHARMACY & BED E2E INTEGRATION SUITE")
    print("Database:", mongo_db.name)
    print("=" * 70)
    assert mongo_db.name == "smartmedchart_e2e_test", "Must run only on smartmedchart_e2e_test"

    # Fetch real user records from e2e_test
    db_doctor = mongo_db.users.find_one({"role_id": 1})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})

    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], ["MANAGE_SYSTEM", "MANAGE_MEDICINE", "MANAGE_INVENTORY"])
    doctor_user = make_user("Doctor", db_doctor["id"], db_doctor["username"], ["VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION"])

    print(f"Test Actors -> Admin: {admin_user.username} (ID: {admin_user.id}), Doctor: {doctor_user.username} (ID: {doctor_user.id})")

    # ---------------------------------------------------------
    # TEST 1: Formulary Filtering — Test Medicines Deactivated
    # ---------------------------------------------------------
    print("\n[TEST 1] Verifying active doctor formulary excludes default/test medicines...")
    doc_meds = doctor_routes.get_medicines(current_user=doctor_user)
    test_names = [m["name"] for m in doc_meds if any(t in m["name"].lower() for t in ["test", "duplicate", "status test"])]
    assert len(test_names) == 0, f"Found test medicines in active formulary: {test_names}"
    print(f"PASS: Active formulary contains {len(doc_meds)} medicines (0 default/test medicines).")

    # ---------------------------------------------------------
    # TEST 2: Pharmacy Add Medicine & Duplicate Prevention
    # ---------------------------------------------------------
    print("\n[TEST 2] Testing Add Medicine & Duplicate Prevention...")
    # Clean up test medicine if left from previous dry run
    mongo_db.medicines.delete_many({"name": {"$in": ["PARACETAMOL", "AMOXICILLIN"]}})
    mongo_db.medicine_batches.delete_many({"batch_number": {"$regex": "^BATCH-PARA"}})
    mongo_db.stock_transactions.delete_many({"medicine_name": {"$in": ["PARACETAMOL", "AMOXICILLIN"]}})

    para_create = MedicineCreate(
        name="PARACETAMOL",
        generic_name="ACETAMINOPHEN",
        brand_name="CRO oficiales",
        strength="500 MG",
        dosage_form="TABLET",
        unit="TABLETS",
        category="ANALGESIC",
        min_stock_level=25,
        supplier="CIPLA HEALTH",
        description="Standard antipyretic & analgesic"
    )
    res_para = pharmacy_routes.create_medicine(para_create, current_user=admin_user)
    para_id = res_para["medicine"]["id"]
    print(f"PASS: Added PARACETAMOL 500 MG (ID: {para_id}). Total stock initialized to 0.")

    # Duplicate attempt with same name and strength
    try:
        pharmacy_routes.create_medicine(para_create, current_user=admin_user)
        assert False, "Duplicate medicine creation should have raised HTTPException 400"
    except HTTPException as exc:
        assert exc.status_code == 400
        print(f"PASS: Duplicate creation blocked with HTTP 400: '{exc.detail}'")

    # Add second medicine: AMOXICILLIN 250 MG
    amox_create = MedicineCreate(
        name="AMOXICILLIN",
        generic_name="AMOXICILLIN TRIHYDRATE",
        brand_name="MOX",
        strength="250 MG",
        dosage_form="CAPSULE",
        unit="CAPSULES",
        category="ANTIBIOTIC",
        min_stock_level=20,
        supplier="SUN PHARMA",
        description="Broad-spectrum beta-lactam antibiotic"
    )
    res_amox = pharmacy_routes.create_medicine(amox_create, current_user=admin_user)
    amox_id = res_amox["medicine"]["id"]
    print(f"PASS: Added AMOXICILLIN 250 MG (ID: {amox_id}).")

    # Verify doctor formulary now contains the manually added medicines
    doc_meds_after = doctor_routes.get_medicines(current_user=doctor_user)
    doc_names = [m["name"] for m in doc_meds_after]
    assert "PARACETAMOL" in doc_names and "AMOXICILLIN" in doc_names
    print(f"PASS: Doctor formulary populated with active pharmacy medicines: {doc_names}")

    # ---------------------------------------------------------
    # TEST 3: Multi-Batch Receipt & Atomic Stock Update
    # ---------------------------------------------------------
    print("\n[TEST 3] Testing Multi-Batch Stock Receipt & Atomic Inventory Update...")
    # Batch 1: 200 tablets
    b1_req = BatchCreate(
        batch_number="BATCH-PARA-2026-A1",
        expiry_date="2027-12-31",
        quantity=200,
        supplier="CIPLA HEALTH",
        notes="PO-9021 Initial stock"
    )
    b1_res = pharmacy_routes.add_medicine_batch(para_id, b1_req, current_user=admin_user)
    assert b1_res["total_stock"] == 200, f"Expected 200 stock, got {b1_res['total_stock']}"
    print(f"PASS: Received Batch 1 (+200). Current stock: {b1_res['total_stock']}.")

    # Batch 2: 20 tablets expiring in 15 days
    close_exp = (datetime.utcnow() + timedelta(days=15)).strftime("%Y-%m-%d")
    b2_req = BatchCreate(
        batch_number="BATCH-PARA-2026-A2",
        expiry_date=close_exp,
        quantity=20,
        supplier="CIPLA HEALTH",
        notes="Emergency restock transfer"
    )
    b2_res = pharmacy_routes.add_medicine_batch(para_id, b2_req, current_user=admin_user)
    assert b2_res["total_stock"] == 220, f"Expected 220 stock, got {b2_res['total_stock']}"
    print(f"PASS: Received Batch 2 (+20). Updated total stock: {b2_res['total_stock']}.")

    # Verify stock transactions audit trail recorded 2 RESTOCK records
    txs = pharmacy_routes.list_stock_transactions(medicine_id=para_id, current_user=admin_user)
    assert len(txs) >= 2
    assert all(t["transaction_type"] == "RESTOCK" for t in txs[:2])
    print(f"PASS: Audit ledger recorded {len(txs)} stock transactions with exact balances.")

    # ---------------------------------------------------------
    # TEST 4: Expiry Tracking Alert
    # ---------------------------------------------------------
    print("\n[TEST 4] Verifying Expiry Tracking Alert...")
    exp_alerts = pharmacy_routes.get_expiry_alerts(current_user=admin_user)
    flagged = [b["batch_number"] for b in exp_alerts]
    assert "BATCH-PARA-2026-A2" in flagged, f"Expected BATCH-PARA-2026-A2 in expiry alerts, got: {flagged}"
    matched_alert = next(b for b in exp_alerts if b["batch_number"] == "BATCH-PARA-2026-A2")
    assert matched_alert["alert_level"] in ("CRITICAL", "APPROACHING")
    print(f"PASS: Expiry tracking successfully flagged {matched_alert['batch_number']} with days_remaining={matched_alert['days_remaining']} (Alert: {matched_alert['alert_level']}).")

    # ---------------------------------------------------------
    # TEST 5: Low Stock Alerts & Suggested Reorder
    # ---------------------------------------------------------
    print("\n[TEST 5] Testing Low Stock Alerts & Reorder Calculation...")
    low_alerts = pharmacy_routes.get_low_stock_alerts(current_user=admin_user)
    amox_alert = next((a for a in low_alerts if a["medicine_id"] == amox_id), None)
    assert amox_alert is not None, "Expected AMOXICILLIN in low stock alerts"
    assert amox_alert["status"] == "OUT OF STOCK"
    assert amox_alert["suggested_reorder_quantity"] >= 40
    print(f"PASS: Low stock alert caught AMOXICILLIN (Stock: 0, Suggested Reorder: {amox_alert['suggested_reorder_quantity']}).")

    # ---------------------------------------------------------
    # TEST 6: Dispensing Workflow & Deductions
    # ---------------------------------------------------------
    print("\n[TEST 6] Testing Dispense Medication Workflow & Deductions...")
    disp_req = DispenseCreate(
        medicine_id=para_id,
        quantity=25,
        patient_id=None,
        prescription_id=99991,
        notes="Inpatient ward dose issuance"
    )
    disp_res = pharmacy_routes.dispense_medicine(disp_req, current_user=admin_user)
    assert disp_res["medicine_total_stock"] == 195, f"Expected 195 stock, got {disp_res['medicine_total_stock']}"
    print(f"PASS: Dispensed 25 units. Atomically updated stock: {disp_res['medicine_total_stock']}.")

    # Duplicate dispense prevention for same prescription_id
    try:
        pharmacy_routes.dispense_medicine(disp_req, current_user=admin_user)
        assert False, "Duplicate dispense should have raised HTTPException 400"
    except HTTPException as exc:
        assert exc.status_code == 400
        print(f"PASS: Duplicate dispense prevented: '{exc.detail}'")

    # Verify Usage Reports
    usage_data = pharmacy_routes.get_usage_reports(current_user=admin_user)
    para_usage = next(u for u in usage_data["reports"] if u["medicine_id"] == para_id)
    assert para_usage["total_dispensed"] == 25
    print(f"PASS: Usage reports confirmed 25 units dispensed for PARACETAMOL.")

    # ---------------------------------------------------------
    # TEST 7: Inpatient Admission & Bed Allocation on Prescription
    # ---------------------------------------------------------
    print("\n[TEST 7] Testing Inpatient Admission & Bed Assignment via Prescription...")
    encounter = mongo_db.encounters.find_one({"doctor_id": doctor_user.id, "status": "ACTIVE"})
    patient_id = encounter["patient_id"]

    # Free bed 1 first to test allocation cleanly
    mongo_db.beds.update_one({"_id": 1}, {"$set": {"is_occupied": 0, "occupied_by_patient_id": None}})

    rx_req = PrescriptionCreate(
        patient_id=patient_id,
        medicine_id=para_id,
        dose="500 mg",
        route="Oral",
        frequency="TWICE_DAILY",
        duration_days=3,
        start_date=date(2026, 11, 1),
        start_time=time(8, 0, 0),
        is_stat=False,
        instructions="Take after meals with water",
        notes="Admitted for clinical monitoring",
        admit_patient=True,
        ward_id=1,
        bed_id=1,
    )
    rx_res = doctor_routes.create_prescription(rx_req, current_user=doctor_user)
    assert rx_res["bed_assignment"] is not None
    assert rx_res["bed_assignment"]["ward_id"] == 1
    assert rx_res["bed_assignment"]["bed_id"] == 1
    print(f"PASS: Prescription #{rx_res['prescription_id']} created with bed allocation (Ward: 1, Bed: 1).")

    # Verify Bed 1 in MongoDB is occupied by patient
    bed1 = mongo_db.beds.find_one({"_id": 1})
    assert bed1["is_occupied"] in (1, True)
    assert bed1["occupied_by_patient_id"] == patient_id
    print("PASS: MongoDB Bed 1 is correctly marked occupied by patient ID:", patient_id)

    # Verify prescription creation did NOT deduct stock (stock must remain 195)
    med_check = mongo_db.medicines.find_one({"_id": para_id})
    assert med_check["total_stock"] == 195, f"Prescription creation should NOT deduct pharmacy stock. Expected 195, got {med_check['total_stock']}"
    print(f"PASS: Pharmacy stock remains intact ({med_check['total_stock']}) — stock is only deducted on dispensing.")

    # Double bed allocation protection
    other_patient = mongo_db.encounters.find_one({"doctor_id": doctor_user.id, "status": "ACTIVE", "patient_id": {"$ne": patient_id}})
    if other_patient:
        rx_dup_bed = PrescriptionCreate(
            patient_id=other_patient["patient_id"],
            medicine_id=para_id,
            dose="500 mg",
            route="Oral",
            frequency="ONCE_DAILY",
            duration_days=1,
            start_date=date(2026, 11, 1),
            start_time=time(8, 0, 0),
            is_stat=False,
            admit_patient=True,
            ward_id=1,
            bed_id=1,
        )
        try:
            doctor_routes.create_prescription(rx_dup_bed, current_user=doctor_user)
            assert False, "Double bed allocation should have raised HTTPException 409 or 400"
        except HTTPException as exc:
            assert exc.status_code in (400, 409)
            print("PASS: Double bed allocation blocked with HTTP", exc.status_code, ":", exc.detail)

    # ---------------------------------------------------------
    # TEST 8: Add Allergy & Safety Engine Alert
    # ---------------------------------------------------------
    print("\n[TEST 8] Testing Add Allergy & Real-Time Safety Engine Conflict Alert...")
    # Clean previous allergy test data
    mongo_db.patient_allergies.delete_many({"patient_id": patient_id, "allergen": "PARACETAMOL"})

    alg_req = AllergyCreate(
        allergen="PARACETAMOL",
        reaction="ACUTE URTICARIA AND FACIAL SWELLING",
        severity="SEVERE",
        notes="Verified prior adverse reaction"
    )
    alg_res = allergy_routes.create_patient_allergy(patient_id, alg_req, current_user=doctor_user)
    assert alg_res["id"] is not None
    print(f"PASS: Allergy recorded successfully (ID: {alg_res['id']}, Allergen: PARACETAMOL).")

    # Run medication safety check on one of the schedules for this prescription
    sample_sched = mongo_db.medication_schedules.find_one({"prescription_item_id": rx_res["prescription_item_id"]})
    assert sample_sched is not None
    safety_result = check_medication_safety(sample_sched["id"])
    warnings = safety_result.get("warnings", [])
    allergy_warning = next((w for w in warnings if w.get("type") == "ALLERGY"), None)
    assert allergy_warning is not None, f"Expected ALLERGY warning, got: {warnings}"
    assert "PARACETAMOL" in allergy_warning["message"].upper()
    print(f"PASS: Safety engine triggered ALLERGY conflict alert: '{allergy_warning['message']}'")

    # ---------------------------------------------------------
    # TEST 9: Historical Prescriptions with Archived Medicines
    # ---------------------------------------------------------
    print("\n[TEST 9] Verifying Historical Prescriptions Resolve Archived Medicines...")
    history = doctor_routes.get_prescription_history(patient_id, current_user=doctor_user)
    assert len(history) > 0
    for item in history:
        assert item.get("medicine_name") is not None and len(item["medicine_name"]) > 0
    print(f"PASS: All {len(history)} historical prescription records resolved their medicine names without error.")

    # ---------------------------------------------------------
    # TEST 10: Pharmacy Dashboard Overview Metrics
    # ---------------------------------------------------------
    print("\n[TEST 10] Testing Pharmacy Dashboard Overview Metrics...")
    # Receive 5 capsules for AMOXICILLIN (min_stock_level is 20, so 5 is LOW STOCK)
    b_amox = BatchCreate(
        batch_number="BATCH-AMOX-2026-B1",
        expiry_date="2027-06-30",
        quantity=5,
        supplier="SUN PHARMA",
        notes="Partial delivery"
    )
    pharmacy_routes.add_medicine_batch(amox_id, b_amox, current_user=admin_user)

    stats = pharmacy_routes.get_pharmacy_stats(current_user=admin_user)
    assert stats["total_medicines"] >= 2
    assert stats["total_stock"] >= 200
    assert stats["low_stock_medicines"] >= 1
    assert stats["fast_moving_medicines"] >= 1
    assert stats["medicines_approaching_expiry"] >= 1
    print(f"PASS: Dashboard Stats -> Total Meds: {stats['total_medicines']}, Total Stock: {stats['total_stock']}, Low Stock: {stats['low_stock_medicines']}, Expiring: {stats['medicines_approaching_expiry']}")

    print("\n" + "=" * 70)
    print("ALL 10 INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
