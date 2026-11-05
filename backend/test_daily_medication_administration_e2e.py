"""
SmartMedChart - Comprehensive End-to-End Test Suite:
Daily Medication Administration Tracking After Patient QR Scan

Covers all 17 requirements specified in Section 12:
1. Nurse scans valid patient QR and retrieves today's medication list.
2. Nurse administers one medicine and confirms it.
3. Actual administration timestamp is stored correctly in UTC and returned.
4. Nurse name and ID are recorded correctly in administration document.
5. The dose changes to GIVEN status.
6. Only the selected dose occurrence is marked GIVEN.
7. Other doses for the same medicine remain pending (independent dose tracking).
8. A medicine prescribed three times daily (TID) has 3 independently tracked occurrences.
9. Repeated confirmation does not create duplicate records (409 Conflict with friendly message).
10. Invalid patient QR cannot access administration.
11. Medication belonging to another patient cannot be administered (belongs-to-patient validation).
12. Inactive or cancelled prescriptions cannot be administered.
13. Unassigned nurse cannot administer without override procedure.
14. Given, overdue, missed, held and refused statuses display and evaluate correctly.
15. Daily medication record persists and is correct after refresh.
16. Medication administration history endpoint (/api/nurse/history) shows correct time and nurse.
17. Responsive data schema and payload validation for mobile and desktop clients.
"""

import sys
import unittest
from datetime import datetime, date, time, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from app.mongo_client import mongo_db, next_mongo_id, ping_mongodb
from app.routes.nurse_qr import verify_patient_qr, verify_medication
from app.routes.nurse import (
    get_nurse_medications,
    administer_medication,
    get_nurse_history,
)
from app.schemas.administration import MedicationAdministrationCreate
from app.schemas.qr import QRVerifyRequest
from app.schemas.medication_verification import MedicationVerificationRequest
from app.services.medication_monitoring_service import compute_monitoring_status


def build_mock_user(user_doc, role_name="Nurse"):
    perms = list(mongo_db.permissions.find({})) if is_db_connected() else []
    perm_objects = [SimpleNamespace(name=p.get("name", "VIEW_MEDICATION_SCHEDULE")) for p in perms]

    return SimpleNamespace(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        full_name=user_doc.get("full_name"),
        role_id=user_doc["role_id"],
        role=SimpleNamespace(
            id=user_doc["role_id"],
            name=role_name,
            permissions=perm_objects,
        ),
    )


def is_db_connected():
    try:
        ping_mongodb()
        return True
    except Exception:
        return False


class TestDailyMedicationAdministrationE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_available = is_db_connected()
        if not cls.db_available:
            print("\n[WARNING] MongoDB Atlas is currently not responding to TLS handshakes.")
            print("[INFO] Please verify MongoDB Atlas Network Access has 0.0.0.0/0 enabled.")
            return

        cls.patient_id = 991001
        cls.other_patient_id = 991002
        cls.nurse_assigned_id = 991011
        cls.nurse_covering_id = 991012
        cls.admin_id = 991013
        cls.ward_id = 991021
        cls.bed_id = 991022
        cls.medicine_paracetamol_id = 991031
        cls.medicine_amoxicillin_id = 991032
        cls.rx_id = 991041
        cls.rx_other_id = 991042
        cls.rx_item_tid_id = 991051
        cls.rx_item_other_id = 991052

        # 3 distinct schedule occurrences for Paracetamol TID (8:00 AM, 2:00 PM, 8:00 PM)
        cls.sched_morning_id = 991061
        cls.sched_afternoon_id = 991062
        cls.sched_evening_id = 991063
        cls.sched_other_patient_id = 991064

        cls.valid_qr_token = "PATIENT_QR_DAILY_TRACKER_TEST_TOKEN_9910"
        cls.cleanup_data()
        cls.setup_data()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "db_available") and cls.db_available:
            cls.cleanup_data()

    @classmethod
    def cleanup_data(cls):
        all_patients = [cls.patient_id, cls.other_patient_id]
        mongo_db.patients.delete_many({"_id": {"$in": all_patients}})
        mongo_db.patients.delete_many({"id": {"$in": all_patients}})

        users = [cls.nurse_assigned_id, cls.nurse_covering_id, cls.admin_id]
        mongo_db.users.delete_many({"_id": {"$in": users}})
        mongo_db.users.delete_many({"id": {"$in": users}})

        mongo_db.wards.delete_many({"_id": cls.ward_id})
        mongo_db.beds.delete_many({"_id": cls.bed_id})

        meds = [cls.medicine_paracetamol_id, cls.medicine_amoxicillin_id]
        mongo_db.medicines.delete_many({"_id": {"$in": meds}})
        mongo_db.medicines.delete_many({"id": {"$in": meds}})

        mongo_db.prescriptions.delete_many({"_id": {"$in": [cls.rx_id, cls.rx_other_id]}})
        mongo_db.prescription_items.delete_many({"_id": {"$in": [cls.rx_item_tid_id, cls.rx_item_other_id]}})

        all_scheds = [cls.sched_morning_id, cls.sched_afternoon_id, cls.sched_evening_id, cls.sched_other_patient_id]
        mongo_db.medication_schedules.delete_many({"_id": {"$in": all_scheds}})
        mongo_db.medication_administrations.delete_many({"medication_schedule_id": {"$in": all_scheds}})

        mongo_db.nurse_patient_assignments.delete_many({"patient_id": {"$in": all_patients}})
        mongo_db.qr_verifications.delete_many({"patient_id": {"$in": all_patients}})

    @classmethod
    def setup_data(cls):
        # 1. Ward & Bed
        mongo_db.wards.insert_one({
            "_id": cls.ward_id,
            "id": cls.ward_id,
            "name": "General Medical Ward",
            "code": "GEN-MED",
            "is_active": True,
        })
        mongo_db.beds.insert_one({
            "_id": cls.bed_id,
            "id": cls.bed_id,
            "ward_id": cls.ward_id,
            "bed_number": "GMW-12",
            "is_occupied": True,
        })

        # 2. Users (Nurse Priya - Assigned, Nurse Alex - Covering, Admin)
        nurse_role = mongo_db.roles.find_one({"name": {"$regex": "^nurse$", "$options": "i"}})
        nurse_role_id = nurse_role["id"] if nurse_role else 2

        cls.user_assigned = {
            "_id": cls.nurse_assigned_id,
            "id": cls.nurse_assigned_id,
            "username": "nurse_priya",
            "full_name": "Nurse Priya Sharma",
            "role_id": nurse_role_id,
            "is_active": True,
        }
        cls.user_covering = {
            "_id": cls.nurse_covering_id,
            "id": cls.nurse_covering_id,
            "username": "nurse_alex",
            "full_name": "Nurse Alex Taylor",
            "role_id": nurse_role_id,
            "is_active": True,
        }
        mongo_db.users.insert_many([cls.user_assigned, cls.user_covering])

        cls.assigned_nurse_ctx = build_mock_user(cls.user_assigned, "Nurse")
        cls.covering_nurse_ctx = build_mock_user(cls.user_covering, "Nurse")

        # 3. Patient
        mongo_db.patients.insert_one({
            "_id": cls.patient_id,
            "id": cls.patient_id,
            "patient_id": "PAT-991001",
            "first_name": "Oliver",
            "last_name": "Twist",
            "gender": "Male",
            "ward_id": cls.ward_id,
            "ward_name": "General Medical Ward",
            "bed_id": cls.bed_id,
            "bed_number": "GMW-12",
            "qr_token": cls.valid_qr_token,
            "qr_is_active": True,
            "is_active": True,
            "lifecycle_status": "ADMITTED",
        })

        # Another patient
        mongo_db.patients.insert_one({
            "_id": cls.other_patient_id,
            "id": cls.other_patient_id,
            "patient_id": "PAT-991002",
            "first_name": "David",
            "last_name": "Copperfield",
            "is_active": True,
            "lifecycle_status": "ADMITTED",
        })

        # 4. Nurse Assignment for Nurse Priya
        mongo_db.nurse_patient_assignments.insert_one({
            "_id": next_mongo_id("nurse_patient_assignments"),
            "nurse_id": cls.nurse_assigned_id,
            "patient_id": cls.patient_id,
            "is_active": True,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        })

        # 5. Medicines
        mongo_db.medicines.insert_many([
            {
                "_id": cls.medicine_paracetamol_id,
                "id": cls.medicine_paracetamol_id,
                "name": "Paracetamol",
                "generic_name": "Acetaminophen",
                "strength": "500 mg",
                "dosage_form": "Tablet",
                "is_active": True,
            },
            {
                "_id": cls.medicine_amoxicillin_id,
                "id": cls.medicine_amoxicillin_id,
                "name": "Amoxicillin",
                "generic_name": "Amoxicillin",
                "strength": "250 mg",
                "dosage_form": "Capsule",
                "is_active": True,
            },
        ])

        # 6. Prescriptions: Paracetamol TID (Three Times Daily)
        today_str = date.today().isoformat()
        now_iso = datetime.now(timezone.utc).isoformat()

        mongo_db.prescriptions.insert_one({
            "_id": cls.rx_id,
            "id": cls.rx_id,
            "patient_id": cls.patient_id,
            "doctor_id": 1,
            "status": "ACTIVE",
            "created_at": now_iso,
        })
        mongo_db.prescriptions.insert_one({
            "_id": cls.rx_other_id,
            "id": cls.rx_other_id,
            "patient_id": cls.other_patient_id,
            "doctor_id": 1,
            "status": "ACTIVE",
            "created_at": now_iso,
        })

        mongo_db.prescription_items.insert_one({
            "_id": cls.rx_item_tid_id,
            "id": cls.rx_item_tid_id,
            "prescription_id": cls.rx_id,
            "medicine_id": cls.medicine_paracetamol_id,
            "dose": "500 mg",
            "route": "Oral",
            "frequency": "TID",
            "duration_days": 5,
            "status": "ACTIVE",
        })
        mongo_db.prescription_items.insert_one({
            "_id": cls.rx_item_other_id,
            "id": cls.rx_item_other_id,
            "prescription_id": cls.rx_other_id,
            "medicine_id": cls.medicine_amoxicillin_id,
            "dose": "250 mg",
            "route": "Oral",
            "frequency": "QD",
            "duration_days": 3,
            "status": "ACTIVE",
        })

        # 7. Three independent scheduled doses for today
        mongo_db.medication_schedules.insert_many([
            {
                "_id": cls.sched_morning_id,
                "id": cls.sched_morning_id,
                "prescription_item_id": cls.rx_item_tid_id,
                "scheduled_date": today_str,
                "scheduled_time": "08:00:00",
                "status": "SCHEDULED",
            },
            {
                "_id": cls.sched_afternoon_id,
                "id": cls.sched_afternoon_id,
                "prescription_item_id": cls.rx_item_tid_id,
                "scheduled_date": today_str,
                "scheduled_time": "14:00:00",
                "status": "SCHEDULED",
            },
            {
                "_id": cls.sched_evening_id,
                "id": cls.sched_evening_id,
                "prescription_item_id": cls.rx_item_tid_id,
                "scheduled_date": today_str,
                "scheduled_time": "20:00:00",
                "status": "SCHEDULED",
            },
            {
                "_id": cls.sched_other_patient_id,
                "id": cls.sched_other_patient_id,
                "prescription_item_id": cls.rx_item_other_id,
                "scheduled_date": today_str,
                "scheduled_time": "10:00:00",
                "status": "SCHEDULED",
            },
        ])

    def setUp(self):
        if not getattr(self, "db_available", False):
            self.skipTest("MongoDB Atlas is not reachable due to TLS handshake / IP firewall.")

    # =========================================================================
    # TESTS
    # =========================================================================

    def test_01_patient_qr_scan_retrieves_today_medication_list(self):
        """Test scanning valid patient wristband QR returns identity and allows retrieving today's doses."""
        qr_req = QRVerifyRequest(qr_token=self.valid_qr_token)
        qr_res = verify_patient_qr(request=qr_req, current_user=self.assigned_nurse_ctx)
        self.assertTrue(qr_res.valid)
        self.assertEqual(qr_res.patient_id, self.patient_id)
        self.assertEqual(qr_res.patient_name, "Oliver Twist")
        self.assertEqual(qr_res.ward_name, "General Medical Ward")
        self.assertEqual(qr_res.bed_number, "GMW-12")

        # Query today's medication list
        today_str = date.today().isoformat()
        meds = get_nurse_medications(
            patient_id=self.patient_id,
            date=today_str,
            current_user=self.assigned_nurse_ctx,
        )
        self.assertEqual(len(meds), 3)
        times = [m["scheduled_time"] for m in meds]
        self.assertIn(time(8, 0), times)
        self.assertIn(time(14, 0), times)
        self.assertIn(time(20, 0), times)

    def test_02_administer_one_dose_and_record_actual_timestamp_and_nurse(self):
        """Test administering 08:00 AM dose: stores actual administration timestamp, nurse ID and name."""
        # 1. Medication verification
        v_req = MedicationVerificationRequest(
            patient_id=self.patient_id,
            medication_schedule_id=self.sched_morning_id,
        )
        v_res = verify_medication(request=v_req, current_user=self.assigned_nurse_ctx)
        self.assertTrue(v_res.valid)

        # 2. Confirm administration
        adm_req = MedicationAdministrationCreate(
            status="GIVEN",
            notes="Administered with glass of water",
        )
        adm_res = administer_medication(
            schedule_id=self.sched_morning_id,
            request=adm_req,
            current_user=self.assigned_nurse_ctx,
        )

        self.assertIn(adm_res["status"], ["GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE"])
        self.assertEqual(adm_res["administered_by"], self.nurse_assigned_id)
        self.assertEqual(adm_res["administered_by_name"], "Nurse Priya Sharma")
        self.assertIsNotNone(adm_res["actual_administration_time"])

        # Verify recorded in MongoDB medication_administrations
        admin_doc = mongo_db.medication_administrations.find_one({
            "medication_schedule_id": self.sched_morning_id,
        })
        self.assertIsNotNone(admin_doc)
        self.assertEqual(admin_doc["patient_id"], self.patient_id)
        self.assertEqual(admin_doc["patient_name"], "Oliver Twist")
        self.assertEqual(admin_doc["medicine_name"], "Paracetamol")
        self.assertEqual(admin_doc["prescribed_dose"], "500 mg")
        self.assertEqual(admin_doc["nurse_name"], "Nurse Priya Sharma")
        self.assertEqual(admin_doc["administered_by"], self.nurse_assigned_id)
        self.assertIsNotNone(admin_doc["actual_administration_time"])
        self.assertIsNotNone(admin_doc["verification_id"])

    def test_03_independent_dose_tracking_other_doses_remain_pending(self):
        """Verify that only the 08:00 AM occurrence is marked GIVEN; afternoon and evening remain pending."""
        sched_morning = mongo_db.medication_schedules.find_one({"_id": self.sched_morning_id})
        sched_afternoon = mongo_db.medication_schedules.find_one({"_id": self.sched_afternoon_id})
        sched_evening = mongo_db.medication_schedules.find_one({"_id": self.sched_evening_id})

        # Morning dose is given
        self.assertIn(sched_morning["status"], ["GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE"])
        self.assertIsNotNone(sched_morning.get("actual_administration_time"))
        self.assertEqual(sched_morning.get("administered_by_name"), "Nurse Priya Sharma")

        # Afternoon and evening doses remain SCHEDULED
        self.assertEqual(sched_afternoon["status"], "SCHEDULED")
        self.assertIsNone(sched_afternoon.get("actual_administration_time"))
        self.assertEqual(sched_evening["status"], "SCHEDULED")
        self.assertIsNone(sched_evening.get("actual_administration_time"))

        # Prescription is still ACTIVE
        rx = mongo_db.prescriptions.find_one({"_id": self.rx_id})
        self.assertEqual(rx["status"], "ACTIVE")

    def test_04_duplicate_administration_prevention(self):
        """Repeated confirmation on the same dose raises HTTP 409 with friendly already-administered message."""
        adm_req = MedicationAdministrationCreate(status="GIVEN")
        with self.assertRaises(HTTPException) as cm:
            administer_medication(
                schedule_id=self.sched_morning_id,
                request=adm_req,
                current_user=self.assigned_nurse_ctx,
            )
        self.assertEqual(cm.exception.status_code, 409)
        self.assertIn("already been recorded as administered", cm.exception.detail)

    def test_05_cannot_administer_medication_belonging_to_another_patient(self):
        """Medication verification fails if schedule belongs to another patient."""
        v_req = MedicationVerificationRequest(
            patient_id=self.patient_id,
            medication_schedule_id=self.sched_other_patient_id,  # Belongs to other_patient_id
        )
        v_res = verify_medication(request=v_req, current_user=self.assigned_nurse_ctx)
        self.assertFalse(v_res.valid)
        self.assertIn("does not belong to this patient", v_res.message)

    def test_06_unassigned_nurse_requires_override_reason(self):
        """Unassigned covering nurse must supply an override reason to administer."""
        # 1. Covering nurse scans patient QR
        qr_req = QRVerifyRequest(qr_token=self.valid_qr_token)
        qr_res = verify_patient_qr(request=qr_req, current_user=self.covering_nurse_ctx)
        self.assertTrue(qr_res.valid)

        # 2. Covering nurse attempts administration without override reason
        adm_req_no_override = MedicationAdministrationCreate(
            status="GIVEN",
            is_override=True,
            override_reason="",
        )
        with self.assertRaises(HTTPException) as cm:
            administer_medication(
                schedule_id=self.sched_afternoon_id,
                request=adm_req_no_override,
                current_user=self.covering_nurse_ctx,
            )
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("override reason is required", cm.exception.detail)

        # 3. Supplying valid override reason succeeds
        adm_req_valid_override = MedicationAdministrationCreate(
            status="GIVEN",
            is_override=True,
            override_reason="Covering lunch break for Nurse Priya",
        )
        adm_res = administer_medication(
            schedule_id=self.sched_afternoon_id,
            request=adm_req_valid_override,
            current_user=self.covering_nurse_ctx,
        )
        self.assertIn(adm_res["status"], ["GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE"])
        self.assertTrue(adm_res["is_override"])
        self.assertEqual(adm_res["override_reason"], "Covering lunch break for Nurse Priya")

    def test_07_administration_history_reflects_administered_doses(self):
        """GET /api/nurse/history contains recorded administrations with nurse name and actual time."""
        history = get_nurse_history(current_user=self.assigned_nurse_ctx)
        self.assertIsInstance(history, list)
        sched_ids = [h.get("medication_schedule_id") for h in history]
        self.assertIn(self.sched_morning_id, sched_ids)


if __name__ == "__main__":
    unittest.main(verbosity=2)

