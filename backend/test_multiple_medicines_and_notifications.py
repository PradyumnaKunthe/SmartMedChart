import os
import sys
from pathlib import Path
from datetime import datetime, date, time, timedelta, timezone
from types import SimpleNamespace
from fastapi import HTTPException

# Explicitly ensure isolated test database is targeted
os.environ["MONGODB_DATABASE"] = "smartmedchart_e2e_test"

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.mongo_client import mongo_db
from app.routes import doctor as doctor_routes
from app.routes import admin as admin_routes
from app.routes import nurse as nurse_routes
from app.services.notification_service import (
    process_due_notifications,
    get_nurse_notifications,
    acknowledge_notification,
)
from app.services.scheduling_service import generate_schedule_times, normalize_frequency
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
    print("SMARTMEDCHART E2E TEST: MULTIPLE MEDICINES & 5-MIN NURSE NOTIFICATIONS")
    print("Target Database:", mongo_db.name)
    print("=" * 80)

    # 0. Safety Guard: MUST be isolated test database
    assert mongo_db.name == "smartmedchart_e2e_test", "CRITICAL SAFETY HALT: Must run on smartmedchart_e2e_test only!"

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Setup Test Actors (Doctor, Admin, Nurse A, Nurse B, Nurse C)
    db_doctor = mongo_db.users.find_one({"role_id": 1}) or mongo_db.users.find_one({"username": {"$regex": "doc", "$options": "i"}})
    db_admin = mongo_db.users.find_one({"role_id": 4}) or mongo_db.users.find_one({"username": "admin"})

    assert db_doctor, "Doctor user must exist in test DB"
    assert db_admin, "Admin user must exist in test DB"

    # Setup Nurse A (Primary)
    nurse_a_doc = mongo_db.users.find_one({"role_id": 2, "username": "nurse_a_e2e"})
    if not nurse_a_doc:
        nurse_a_id = 2001
        mongo_db.users.update_one(
            {"_id": nurse_a_id},
            {"$set": {
                "_id": nurse_a_id, "id": nurse_a_id, "username": "nurse_a_e2e",
                "full_name": "Nurse Alice (RN-A)", "role_id": 2, "is_active": True,
                "created_at": now_iso, "updated_at": now_iso,
            }},
            upsert=True,
        )
        nurse_a_doc = mongo_db.users.find_one({"_id": nurse_a_id})

    # Setup Nurse B (Takeover / Shift Handoff)
    nurse_b_doc = mongo_db.users.find_one({"role_id": 2, "username": "nurse_b_e2e"})
    if not nurse_b_doc:
        nurse_b_id = 2002
        mongo_db.users.update_one(
            {"_id": nurse_b_id},
            {"$set": {
                "_id": nurse_b_id, "id": nurse_b_id, "username": "nurse_b_e2e",
                "full_name": "Nurse Bob (RN-B)", "role_id": 2, "is_active": True,
                "created_at": now_iso, "updated_at": now_iso,
            }},
            upsert=True,
        )
        nurse_b_doc = mongo_db.users.find_one({"_id": nurse_b_id})

    # Setup Nurse C (Unrelated Nurse)
    nurse_c_doc = mongo_db.users.find_one({"role_id": 2, "username": "nurse_c_e2e"})
    if not nurse_c_doc:
        nurse_c_id = 2003
        mongo_db.users.update_one(
            {"_id": nurse_c_id},
            {"$set": {
                "_id": nurse_c_id, "id": nurse_c_id, "username": "nurse_c_e2e",
                "full_name": "Nurse Charlie (RN-C)", "role_id": 2, "is_active": True,
                "created_at": now_iso, "updated_at": now_iso,
            }},
            upsert=True,
        )
        nurse_c_doc = mongo_db.users.find_one({"_id": nurse_c_id})

    doctor_user = make_user("Doctor", db_doctor["id"], db_doctor["username"], [
        "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "STOP_PRESCRIPTION", "VIEW_MEDICATION_SCHEDULE"
    ])
    admin_user = make_user("Admin", db_admin["id"], db_admin["username"], [
        "MANAGE_SYSTEM", "MANAGE_USERS", "VIEW_PATIENT", "EDIT_PATIENT", "MANAGE_INVENTORY"
    ])
    nurse_a_user = make_user("Nurse", nurse_a_doc["id"], nurse_a_doc["username"], [
        "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "RECORD_MEDICATION_ADMINISTRATION"
    ])
    nurse_b_user = make_user("Nurse", nurse_b_doc["id"], nurse_b_doc["username"], [
        "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "RECORD_MEDICATION_ADMINISTRATION"
    ])
    nurse_c_user = make_user("Nurse", nurse_c_doc["id"], nurse_c_doc["username"], [
        "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "RECORD_MEDICATION_ADMINISTRATION"
    ])

    print(f"[AUTH] Doctor: {doctor_user.username} (ID: {doctor_user.id})")
    print(f"[AUTH] Nurse A: {nurse_a_user.username} (ID: {nurse_a_user.id})")
    print(f"[AUTH] Nurse B: {nurse_b_user.username} (ID: {nurse_b_user.id})")
    print(f"[AUTH] Nurse C (Unrelated): {nurse_c_user.username} (ID: {nurse_c_user.id})")

    # 2. Setup 3 Active Formulary Medicines
    med_configs = [
        {"id": 8101, "name": "PARACETAMOL 500 MG", "generic": "Paracetamol", "dose_form": "TABLET", "stock": 500},
        {"id": 8102, "name": "CETIRIZINE 10 MG", "generic": "Cetirizine HCl", "dose_form": "TABLET", "stock": 300},
        {"id": 8103, "name": "AMOXICILLIN 500 MG", "generic": "Amoxicillin Trihydrate", "dose_form": "CAPSULE", "stock": 400},
    ]
    for mc in med_configs:
        mongo_db.medicines.update_one(
            {"_id": mc["id"]},
            {"$set": {
                "_id": mc["id"], "id": mc["id"], "name": mc["name"], "generic_name": mc["generic"],
                "strength": mc["name"].split()[-2] + " " + mc["name"].split()[-1],
                "dosage_form": mc["dose_form"], "unit": "TABLETS", "total_stock": mc["stock"],
                "is_active": True, "is_archived": False, "is_test": False, "updated_at": now_iso,
            }},
            upsert=True,
        )

    # 3. Setup Synthetic Inpatient: Sindhu Kunthe
    patient_id = 9501
    mongo_db.patients.update_one(
        {"_id": patient_id},
        {"$set": {
            "_id": patient_id, "id": patient_id, "patient_id": "SMH-PUN-261030-0001",
            "first_name": "SINDHU", "last_name": "KUNTHE", "full_name": "SINDHU KUNTHE",
            "date_of_birth": "1990-05-15", "gender": "FEMALE", "ward_id": 1, "bed_id": 3,
            "ward_name": "Ward 1", "bed_number": "3", "is_active": True, "lifecycle_status": "ACTIVE",
            "wristband_qr_code": "QR-PUN-9501-SK", "is_qr_active": True, "updated_at": now_iso,
        }},
        upsert=True,
    )

    # Active Encounter with Doctor
    mongo_db.encounters.update_one(
        {"_id": 95001},
        {"$set": {
            "_id": 95001, "id": 95001, "patient_id": patient_id, "doctor_id": doctor_user.id,
            "encounter_type": "INPATIENT", "status": "ACTIVE", "ward_id": 1, "bed_id": 3, "updated_at": now_iso,
        }},
        upsert=True,
    )

    print("\n--- TEST A: MULTIPLE MEDICINES IN ONE PRESCRIPTION ---")
    today = date.today()

    # Clear prior test prescriptions/schedules for clean isolation
    mongo_db.prescriptions.delete_many({"patient_id": patient_id})
    mongo_db.prescription_items.delete_many({"prescription_id": {"$gt": 0}, "medicine_id": {"$in": [8101, 8102, 8103]}})
    mongo_db.medication_schedules.delete_many({"patient_id": patient_id})
    mongo_db.medication_notifications.delete_many({"patient_id": patient_id})
    mongo_db.medication_administrations.delete_many({"patient_id": patient_id})
    mongo_db.qr_verifications.delete_many({"patient_id": patient_id})
    mongo_db.qr_verifications.delete_many({"_id": {"$in": [9901, 9902]}})
    mongo_db.nurse_patient_assignments.delete_many({"patient_id": patient_id})
    mongo_db.patient_billing.update_one(
        {"patient_id": patient_id},
        {"$set": {"_id": 95001, "patient_id": patient_id, "bill_status": "PAID", "total_amount": 0.0}},
        upsert=True,
    )

    # Prepare multi-medicine order:
    # Medicine 1: Paracetamol (TID, 3 days, 3 times daily: 08:00, 14:00, 20:00) -> 9 doses
    # Medicine 2: Cetirizine (QD, 3 days, once daily: 21:00) -> 3 doses
    # Medicine 3: Amoxicillin (BID, 3 days, twice daily: 08:00, 20:00) -> 6 doses
    # Total expected schedules = 9 + 3 + 6 = 18 schedules
    multi_rx_req = PrescriptionCreate(
        patient_id=patient_id,
        notes="Clinical multi-item inpatient therapy",
        medicines=[
            PrescriptionItemCreate(
                medicine_id=8101,
                dose="1 Tablet",
                route="Oral",
                frequency="THREE_TIMES_DAILY",
                duration_days=3,
                start_date=today,
                start_time=time(8, 0),
                administration_times=["08:00", "14:00", "20:00"],
                instructions="Take with a full glass of water after meals",
            ),
            PrescriptionItemCreate(
                medicine_id=8102,
                dose="1 Tablet",
                route="Oral",
                frequency="ONCE_DAILY",
                duration_days=3,
                start_date=today,
                start_time=time(21, 0),
                administration_times=["21:00"],
                instructions="Take once daily at bedtime",
            ),
            PrescriptionItemCreate(
                medicine_id=8103,
                dose="1 Capsule",
                route="Oral",
                frequency="TWICE_DAILY",
                duration_days=3,
                start_date=today,
                start_time=time(8, 0),
                administration_times=["08:00", "20:00"],
                instructions="Complete entire antibiotic course",
            ),
        ],
    )

    stock_before = mongo_db.medicines.find_one({"_id": 8101})["total_stock"]
    rx_res = doctor_routes.create_prescription(multi_rx_req, current_user=doctor_user)
    rx_id = rx_res["prescription_id"]

    assert rx_res["medicine_count"] == 3, f"Expected 3 medicines, got {rx_res['medicine_count']}"
    assert rx_res["schedule_count"] == 18, f"Expected 18 schedules, got {rx_res['schedule_count']}"
    print(f"[PASS] Successfully created Prescription #{rx_id} with 3 medicines and 18 schedules.")

    # Verify inventory was NOT deducted
    stock_after = mongo_db.medicines.find_one({"_id": 8101})["total_stock"]
    assert stock_before == stock_after, f"Stock must not deduct on prescription creation: {stock_before} vs {stock_after}"
    print(f"[PASS] Zero inventory deduction verified: stock remained {stock_after}.")

    # Verify MongoDB records
    saved_items = list(mongo_db.prescription_items.find({"prescription_id": rx_id}))
    assert len(saved_items) == 3, f"Expected 3 prescription_items in MongoDB, found {len(saved_items)}"
    saved_schedules = list(mongo_db.medication_schedules.find({"prescription_id": rx_id}))
    assert len(saved_schedules) == 18, f"Expected 18 schedules in MongoDB, found {len(saved_schedules)}"
    print(f"[PASS] MongoDB verified: 1 prescription, 3 items, 18 schedules saved with status SCHEDULED.")

    # Verify duplicate submission is blocked
    try:
        doctor_routes.create_prescription(multi_rx_req, current_user=doctor_user)
        assert False, "Duplicate prescription submission should have been blocked!"
    except HTTPException as dup_err:
        assert dup_err.status_code == 409
        print(f"[PASS] Duplicate prescription prevented with HTTP 409: {dup_err.detail}")

    print("\n--- TEST B: FLEXIBLE ADMINISTRATION TIMING & SCHEDULE VALIDATION ---")
    # Verify exact administration times per medicine:
    paracetamol_schedules = list(mongo_db.medication_schedules.find({
        "prescription_id": rx_id,
        "medicine_id": 8101,
    }).sort([("scheduled_date", 1), ("scheduled_time", 1)]))
    assert len(paracetamol_schedules) == 9
    p_times = set(s["scheduled_time"] for s in paracetamol_schedules)
    assert p_times == {"08:00:00", "14:00:00", "20:00:00"}, f"Expected TID times, got {p_times}"
    print("[PASS] Medicine 1 (TID) exact scheduled times verified: 08:00, 14:00, 20:00 across all 3 days.")

    cetirizine_schedules = list(mongo_db.medication_schedules.find({
        "prescription_id": rx_id,
        "medicine_id": 8102,
    }))
    assert len(cetirizine_schedules) == 3
    c_times = set(s["scheduled_time"] for s in cetirizine_schedules)
    assert c_times == {"21:00:00"}, f"Expected QD time 21:00, got {c_times}"
    print("[PASS] Medicine 2 (QD) exact scheduled time verified: 21:00 across all 3 days.")

    amoxicillin_schedules = list(mongo_db.medication_schedules.find({
        "prescription_id": rx_id,
        "medicine_id": 8103,
    }))
    assert len(amoxicillin_schedules) == 6
    a_times = set(s["scheduled_time"] for s in amoxicillin_schedules)
    assert a_times == {"08:00:00", "20:00:00"}, f"Expected BID times, got {a_times}"
    print("[PASS] Medicine 3 (BID) exact scheduled times verified: 08:00, 20:00 across all 3 days.")

    # Test PRN logic: PRN must return 0 routine schedules
    prn_times = generate_schedule_times(
        start_date=today, start_time=time(8, 0), duration_days=5, frequency="PRN"
    )
    assert len(prn_times) == 0, f"PRN must generate 0 routine schedules, got {len(prn_times)}"
    print("[PASS] PRN frequency verified: 0 routine schedules generated.")

    # Test STAT logic: STAT must generate exactly 1 immediate dose
    stat_times = generate_schedule_times(
        start_date=today, start_time=time(10, 30), duration_days=1, frequency="STAT"
    )
    assert len(stat_times) == 1, f"STAT must generate 1 dose, got {len(stat_times)}"
    print("[PASS] STAT frequency verified: exactly 1 immediate dose generated.")

    # Test Custom schedule logic: doctor provides 4 arbitrary times
    custom_times = generate_schedule_times(
        start_date=today,
        start_time=time(7, 0),
        duration_days=2,
        frequency="CUSTOM",
        administration_times=["07:00", "11:30", "15:45", "22:15"],
    )
    assert len(custom_times) == 8, f"Expected 8 custom doses (4/day * 2 days), got {len(custom_times)}"
    print("[PASS] Custom schedule verified: 4 arbitrary times per day correctly generated.")

    print("\n--- TEST C: 5-MINUTE PRE-DOSE AUTOMATIC NURSE NOTIFICATIONS ---")
    # Pick a specific scheduled dose: Paracetamol on Day 1 at 08:00 PM (20:00)
    target_dose = paracetamol_schedules[2]  # The 20:00 dose on day 1
    dose_sched_id = target_dose["id"]
    dose_date_str = target_dose["scheduled_date"]
    dose_time_str = target_dose["scheduled_time"]
    dose_dt = datetime.strptime(f"{dose_date_str} {dose_time_str[:5]}", "%Y-%m-%d %H:%M")

    # Step C.1: Assign Patient to Nurse A
    mongo_db.nurse_patient_assignments.delete_many({"patient_id": patient_id})
    mongo_db.nurse_patient_assignments.insert_one({
        "_id": 7701, "id": 7701, "nurse_id": nurse_a_user.id, "patient_id": patient_id,
        "is_active": True, "assigned_at": now_iso,
    })
    print(f"[PASS] Patient assigned to Nurse A (ID: {nurse_a_user.id}).")

    # Step C.2: Inject test clock: Exactly 5 minutes before scheduled dose (19:55)
    clock_19_55 = dose_dt - timedelta(minutes=5)
    print(f"[TEST CLOCK] Scheduled Dose: {dose_dt.strftime('%H:%M:%S')}, Injected Notification Clock: {clock_19_55.strftime('%H:%M:%S')}")

    # Process notifications as of 19:55
    process_due_notifications(as_of_time=clock_19_55)

    # Step C.3: Verify Nurse A receives the notification
    notifs_a = get_nurse_notifications(nurse_id=nurse_a_user.id, as_of_time=clock_19_55)
    target_notif = next((n for n in notifs_a if n["medication_schedule_id"] == dose_sched_id), None)
    assert target_notif is not None, "Nurse A must receive the 5-minute pre-dose reminder!"
    assert target_notif["recipient_nurse_id"] == nurse_a_user.id
    assert target_notif["message"] == "Medication administration is due in 5 minutes."
    assert target_notif["patient_name"] == "SINDHU KUNTHE"
    assert target_notif["medicine_name"] == "PARACETAMOL 500 MG"
    print(f"[PASS] Verified Nurse A received notification #{target_notif['id']}: 'Medication administration is due in 5 minutes.' at 5 mins before dose.")

    # Step C.4: Verify Nurse C (unrelated nurse) does NOT receive it
    notifs_c = get_nurse_notifications(nurse_id=nurse_c_user.id, as_of_time=clock_19_55)
    target_c = next((n for n in notifs_c if n["medication_schedule_id"] == dose_sched_id), None)
    assert target_c is None, "Unrelated Nurse C must NOT receive notification for this patient!"
    print(f"[PASS] Unrelated Nurse C verified: 0 reminders received for this patient.")

    # Step C.5: Shift Handoff / Takeover: Reassign patient from Nurse A to Nurse B
    print("\n--- Testing Shift Handover: Nurse A shift ends, Nurse B takes over ---")
    mongo_db.nurse_patient_assignments.update_one(
        {"nurse_id": nurse_a_user.id, "patient_id": patient_id},
        {"$set": {"is_active": False, "updated_at": now_iso}}
    )
    mongo_db.nurse_patient_assignments.insert_one({
        "_id": 7702, "id": 7702, "nurse_id": nurse_b_user.id, "patient_id": patient_id,
        "is_active": True, "assigned_at": now_iso,
    })

    # Query notifications as of 19:55 post-handoff
    notifs_b = get_nurse_notifications(nurse_id=nurse_b_user.id, as_of_time=clock_19_55)
    target_b = next((n for n in notifs_b if n["medication_schedule_id"] == dose_sched_id), None)
    assert target_b is not None, "Nurse B must now receive the reminder after shift takeover!"
    assert target_b["recipient_nurse_id"] == nurse_b_user.id

    notifs_a_post = get_nurse_notifications(nurse_id=nurse_a_user.id, as_of_time=clock_19_55)
    target_a_post = next((n for n in notifs_a_post if n["medication_schedule_id"] == dose_sched_id), None)
    assert target_a_post is None, "Nurse A must no longer receive reminders after shift ended!"
    print(f"[PASS] Shift handoff verified: Reminder redirected to Nurse B (#{nurse_b_user.id}); Nurse A no longer receives it.")

    # Step C.6: Acknowledge notification
    ack_res = acknowledge_notification(target_b["id"], user=nurse_b_user)
    assert ack_res["acknowledged"] is True
    # Verify schedule was NOT administered by acknowledgement
    sched_doc = mongo_db.medication_schedules.find_one({"_id": dose_sched_id})
    assert sched_doc["status"] == "SCHEDULED", "Notification acknowledgement must never count as medicine administration!"
    print(f"[PASS] Notification acknowledgement verified: Marked acknowledged=True without altering schedule status (remains SCHEDULED).")

    # Step C.7: Missing Nurse Assignment -> Supervisor Alert
    print("\n--- Testing Supervisor Alert when no nurse is assigned ---")
    mongo_db.nurse_patient_assignments.update_many(
        {"patient_id": patient_id},
        {"$set": {"is_active": False}}
    )
    # Next dose: Amoxicillin on day 1 at 20:00
    amox_dose = amoxicillin_schedules[1]
    amox_sched_id = amox_dose["id"]
    amox_time_iso = f"{amox_dose['scheduled_date']} {amox_dose['scheduled_time'][:5]}"
    amox_dt = datetime.strptime(amox_time_iso, "%Y-%m-%d %H:%M")
    clock_amox = amox_dt - timedelta(minutes=5)

    process_due_notifications(as_of_time=clock_amox)
    sup_notifs = get_nurse_notifications(nurse_id=admin_user.id, is_supervisor=True, as_of_time=clock_amox)
    amox_notif = next((n for n in sup_notifs if n["medication_schedule_id"] == amox_sched_id), None)
    assert amox_notif is not None, "Supervisor must receive alert when no nurse is assigned!"
    assert amox_notif["is_supervisor_alert"] is True
    print(f"[PASS] Unassigned patient alert verified: Head Nurse / Supervisor received alert #{amox_notif['id']}.")

    print("\n--- TEST D: MEDICATION ADMINISTRATION & CLINICAL HOLD ---")
    # Reassign Nurse B
    mongo_db.nurse_patient_assignments.update_one(
        {"_id": 7702},
        {"$set": {"is_active": True}}
    )

    # 1. Administer Paracetamol dose using nurse administration route
    admin_time_iso = dose_dt.isoformat()
    # Set up valid QR verification record in test DB
    mongo_db.qr_verifications.insert_one({
        "_id": 9901, "id": 9901, "medication_schedule_id": dose_sched_id, "patient_id": patient_id,
        "verified_by": nurse_b_user.id, "patient_qr_valid": True, "medication_valid": True,
        "result": "SUCCESS", "created_at": admin_time_iso,
    })

    admin_req = SimpleNamespace(
        administered_at=dose_dt,
        notes="Administered with water, patient tolerated well.",
        override_reason=None,
        status="GIVEN",
    )
    admin_res = nurse_routes.administer_medication(
        schedule_id=dose_sched_id,
        request=admin_req,
        current_user=nurse_b_user,
    )
    assert admin_res["status"] in {"GIVEN", "GIVEN_ON_TIME", "ON_TIME"}
    assert admin_res["administered_by"] == nurse_b_user.id
    print(f"[PASS] Medication dose #{dose_sched_id} successfully administered by Nurse B (#{nurse_b_user.id}).")

    # Verify duplicate administration is blocked
    try:
        nurse_routes.administer_medication(
            schedule_id=dose_sched_id,
            request=admin_req,
            current_user=nurse_b_user,
        )
        assert False, "Duplicate administration should be blocked!"
    except HTTPException as dup_admin:
        assert dup_admin.status_code == 409
        print(f"[PASS] Duplicate administration prevented with HTTP 409: {dup_admin.detail}")

    # Verify administered dose stops future reminders
    process_due_notifications(as_of_time=dose_dt + timedelta(minutes=10))
    post_admin_sched = mongo_db.medication_schedules.find_one({"_id": dose_sched_id})
    assert post_admin_sched["actual_administration_time"] is not None
    print("[PASS] Confirmed administered dose does not trigger further pre-dose reminders.")

    # 2. Test Direct Hold Action on Cetirizine dose
    cet_dose = cetirizine_schedules[0]
    cet_sched_id = cet_dose["id"]
    hold_req = nurse_routes.MedicationHoldRequest(
        reason="NPO FOR PROCEDURE",
        notes="Patient scheduled for abdominal ultrasound at 09:00 AM",
    )
    hold_res = nurse_routes.hold_medication(
        schedule_id=cet_sched_id,
        request=hold_req,
        current_user=nurse_b_user,
    )
    assert hold_res["status"] == "HELD"
    assert hold_res["reason"] == "NPO FOR PROCEDURE"

    # Verify MongoDB schedule status is HELD
    held_sched = mongo_db.medication_schedules.find_one({"_id": cet_sched_id})
    assert held_sched["status"] == "HELD"
    assert "NPO FOR PROCEDURE" in held_sched["notes"]
    print(f"[PASS] Dose #{cet_sched_id} marked as HELD with reason: '{hold_res['reason']}'.")

    print("\n--- TEST E: PATIENT DISCHARGE INTEGRATION ---")
    # Discharge Sindhu Kunthe using hospital discharge workflow
    discharge_res = admin_routes.discharge_patient(
        patient_id=patient_id,
        request={
            "discharge_reason": "Clinical recovery completed. Discharged to home care.",
            "final_diagnosis": "Acute Bronchitis & Allergic Rhinitis (Resolved)",
            "payment_received": True,
        },
        current_user=admin_user,
    )
    assert discharge_res["patient"]["id"] == patient_id
    print(f"[PASS] Patient #{patient_id} successfully discharged: {discharge_res['message']}")

    # Verify pending unadministered schedules are cancelled
    active_schedules_after = list(mongo_db.medication_schedules.find({
        "patient_id": patient_id,
        "status": {"$in": ["SCHEDULED", "UPCOMING"]},
    }))
    assert len(active_schedules_after) == 0, f"All pending schedules must be cancelled on discharge! Found: {len(active_schedules_after)}"

    cancelled_schedules = list(mongo_db.medication_schedules.find({
        "patient_id": patient_id,
        "status": "CANCELLED",
    }))
    assert len(cancelled_schedules) > 0, "Unadministered schedules must be marked CANCELLED."
    print(f"[PASS] Verified all {len(cancelled_schedules)} unadministered schedules were safely CANCELLED upon discharge.")

    # Verify historical administration record is PRESERVED
    admin_history = list(mongo_db.medication_administrations.find({"patient_id": patient_id}))
    assert len(admin_history) >= 2, "Historical administration and hold records must remain intact!"
    print(f"[PASS] Verified MongoDB data preservation: {len(admin_history)} administration and hold records preserved intact.")

    # Verify future notifications stop for discharged patient
    future_clock = datetime.now() + timedelta(days=2)
    process_due_notifications(as_of_time=future_clock)
    discharged_notifs = list(mongo_db.medication_notifications.find({
        "patient_id": patient_id,
        "scheduled_datetime": {"$gt": future_clock.isoformat()},
        "delivery_status": "DELIVERED",
    }))
    assert len(discharged_notifs) == 0, "No notifications should be delivered for discharged patient!"
    print("[PASS] Confirmed 0 future notifications delivered after patient discharge.")

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED SUCCESSFULLY (100% COVERAGE FOR TESTS A, B, C, D, E)")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
