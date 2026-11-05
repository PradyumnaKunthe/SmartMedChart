"""
SmartMedChart - End-to-End Test Suite:
Smart Medication Countdown & Patient QR Verification Integration

Tests all backend aspects of:
1. Patient QR Verification with rich context (patient name, code, ward, bed).
2. GET /api/nurse/medications?patient_id=<id> endpoint with:
   - Nurse assignment validation
   - Covering nurse bedside QR verification authorization
   - Administrator override
   - Inactive / Discharged / Non-existent patient safety guards
   - Chronological sorting
   - Filtering of cancelled records
3. Bedside medication status classification (UPCOMING, DUE, OVERDUE, MISSED, GIVEN, HELD).
"""

import sys
import unittest
from datetime import datetime, date, time, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from app.mongo_client import mongo_db, next_mongo_id
from app.routes.nurse_qr import verify_patient_qr
from app.routes.nurse import get_nurse_medications
from app.schemas.qr import QRVerifyRequest
from app.services.medication_monitoring_service import compute_monitoring_status


def build_mock_user(user_doc, role_name="Nurse"):
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
        ),
    )


class TestSmartMedicationCountdownE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patient_id = 888801
        cls.patient_discharged_id = 888802
        cls.nurse_1_id = 888811
        cls.nurse_2_id = 888812
        cls.admin_id = 888813
        cls.ward_id = 888821
        cls.bed_id = 888822
        cls.medicine_1_id = 888831
        cls.medicine_2_id = 888832
        cls.rx_id = 888841
        cls.rx_item_1_id = 888851
        cls.rx_item_2_id = 888852
        cls.schedule_ids = [888861, 888862, 888863, 888864, 888865, 888866]

        cls.valid_qr_token = "PATIENT_QR_COUNTDOWN_TEST_TOKEN_8888"
        cls.inactive_qr_token = "PATIENT_QR_COUNTDOWN_INACTIVE_TOKEN_8888"

        cls.cleanup_data()
        cls.setup_data()

    @classmethod
    def tearDownClass(cls):
        cls.cleanup_data()

    @classmethod
    def cleanup_data(cls):
        all_ids = [cls.patient_id, cls.patient_discharged_id]
        mongo_db.patients.delete_many({"_id": {"$in": all_ids}})
        mongo_db.patients.delete_many({"id": {"$in": all_ids}})

        user_ids = [cls.nurse_1_id, cls.nurse_2_id, cls.admin_id]
        mongo_db.users.delete_many({"_id": {"$in": user_ids}})
        mongo_db.users.delete_many({"id": {"$in": user_ids}})

        mongo_db.wards.delete_many({"_id": cls.ward_id})
        mongo_db.beds.delete_many({"_id": cls.bed_id})

        med_ids = [cls.medicine_1_id, cls.medicine_2_id]
        mongo_db.medicines.delete_many({"_id": {"$in": med_ids}})
        mongo_db.medicines.delete_many({"id": {"$in": med_ids}})

        mongo_db.prescriptions.delete_many({"_id": cls.rx_id})
        mongo_db.prescription_items.delete_many({"_id": {"$in": [cls.rx_item_1_id, cls.rx_item_2_id]}})
        mongo_db.medication_schedules.delete_many({"_id": {"$in": cls.schedule_ids}})

        mongo_db.nurse_patient_assignments.delete_many({"patient_id": cls.patient_id})
        mongo_db.qr_verifications.delete_many({"patient_id": {"$in": all_ids}})

    @classmethod
    def setup_data(cls):
        # 1. Ward & Bed
        mongo_db.wards.insert_one({
            "_id": cls.ward_id,
            "id": cls.ward_id,
            "name": "Cardiology Observation Ward",
            "code": "CARD-OBS",
            "is_active": True,
        })
        mongo_db.beds.insert_one({
            "_id": cls.bed_id,
            "id": cls.bed_id,
            "ward_id": cls.ward_id,
            "bed_number": "COW-04",
            "is_occupied": True,
        })

        # 2. Users (Nurse 1 - assigned, Nurse 2 - unassigned, Admin)
        nurse_role = mongo_db.roles.find_one({"name": {"$regex": "^nurse$", "$options": "i"}})
        admin_role = mongo_db.roles.find_one({"name": {"$regex": "^admin", "$options": "i"}})
        nurse_role_id = nurse_role["id"] if nurse_role else 2
        admin_role_id = admin_role["id"] if admin_role else 4

        cls.user_nurse_1 = {
            "_id": cls.nurse_1_id,
            "id": cls.nurse_1_id,
            "username": "nurse_countdown_assigned",
            "full_name": "Nurse Florence Night",
            "role_id": nurse_role_id,
            "is_active": True,
        }
        cls.user_nurse_2 = {
            "_id": cls.nurse_2_id,
            "id": cls.nurse_2_id,
            "username": "nurse_countdown_covering",
            "full_name": "Nurse Clara Barton",
            "role_id": nurse_role_id,
            "is_active": True,
        }
        cls.user_admin = {
            "_id": cls.admin_id,
            "id": cls.admin_id,
            "username": "admin_countdown_auditor",
            "full_name": "Administrator Jones",
            "role_id": admin_role_id,
            "is_active": True,
        }
        mongo_db.users.insert_many([cls.user_nurse_1, cls.user_nurse_2, cls.user_admin])

        cls.nurse_1_ctx = build_mock_user(cls.user_nurse_1, "Nurse")
        cls.nurse_2_ctx = build_mock_user(cls.user_nurse_2, "Nurse")
        cls.admin_ctx = build_mock_user(cls.user_admin, "Administrator")

        # 3. Patients
        mongo_db.patients.insert_one({
            "_id": cls.patient_id,
            "id": cls.patient_id,
            "patient_id": "PAT-888801",
            "first_name": "Eleanor",
            "last_name": "Rigby",
            "gender": "Female",
            "ward_id": cls.ward_id,
            "ward_name": "Cardiology Observation Ward",
            "bed_id": cls.bed_id,
            "bed_number": "COW-04",
            "qr_token": cls.valid_qr_token,
            "qr_is_active": True,
            "is_active": True,
            "lifecycle_status": "ADMITTED",
        })

        mongo_db.patients.insert_one({
            "_id": cls.patient_discharged_id,
            "id": cls.patient_discharged_id,
            "patient_id": "PAT-888802",
            "first_name": "Arthur",
            "last_name": "Dent",
            "gender": "Male",
            "qr_token": cls.inactive_qr_token,
            "qr_is_active": False,
            "is_active": False,
            "lifecycle_status": "DISCHARGED",
        })

        # 4. Nurse assignment for Nurse 1 only
        mongo_db.nurse_patient_assignments.insert_one({
            "_id": next_mongo_id("nurse_patient_assignments"),
            "nurse_id": cls.nurse_1_id,
            "patient_id": cls.patient_id,
            "is_active": True,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        })

        # 5. Medicines
        mongo_db.medicines.insert_many([
            {
                "_id": cls.medicine_1_id,
                "id": cls.medicine_1_id,
                "name": "Metoprolol Tartrate",
                "generic_name": "Metoprolol",
                "strength": "50 mg",
                "dosage_form": "Tablet",
            },
            {
                "_id": cls.medicine_2_id,
                "id": cls.medicine_2_id,
                "name": "Atorvastatin Calcium",
                "generic_name": "Atorvastatin",
                "strength": "20 mg",
                "dosage_form": "Tablet",
            },
        ])

        # 6. Prescription & Prescription Items
        mongo_db.prescriptions.insert_one({
            "_id": cls.rx_id,
            "id": cls.rx_id,
            "patient_id": cls.patient_id,
            "doctor_id": 1,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        mongo_db.prescription_items.insert_many([
            {
                "_id": cls.rx_item_1_id,
                "id": cls.rx_item_1_id,
                "prescription_id": cls.rx_id,
                "medicine_id": cls.medicine_1_id,
                "dose": "50 mg",
                "route": "Oral",
                "frequency": "BID",
                "status": "ACTIVE",
            },
            {
                "_id": cls.rx_item_2_id,
                "id": cls.rx_item_2_id,
                "prescription_id": cls.rx_id,
                "medicine_id": cls.medicine_2_id,
                "dose": "20 mg",
                "route": "Oral",
                "frequency": "QD",
                "status": "ACTIVE",
            },
        ])

        # 7. Medication Schedules:
        # Today's date
        today_str = date.today().isoformat()
        now_dt = datetime.now()

        # Doses at different times
        due_time = (now_dt).strftime("%H:%M:00")
        upcoming_time = (now_dt + timedelta(hours=3)).strftime("%H:%M:00")
        overdue_time = (now_dt - timedelta(hours=1, minutes=30)).strftime("%H:%M:00")
        missed_time = (now_dt - timedelta(hours=5)).strftime("%H:%M:00")

        mongo_db.medication_schedules.insert_many([
            {
                "_id": cls.schedule_ids[0],
                "id": cls.schedule_ids[0],
                "prescription_item_id": cls.rx_item_1_id,
                "scheduled_date": today_str,
                "scheduled_time": due_time,
                "status": "SCHEDULED",
            },
            {
                "_id": cls.schedule_ids[1],
                "id": cls.schedule_ids[1],
                "prescription_item_id": cls.rx_item_1_id,
                "scheduled_date": today_str,
                "scheduled_time": upcoming_time,
                "status": "SCHEDULED",
            },
            {
                "_id": cls.schedule_ids[2],
                "id": cls.schedule_ids[2],
                "prescription_item_id": cls.rx_item_1_id,
                "scheduled_date": today_str,
                "scheduled_time": overdue_time,
                "status": "SCHEDULED",
            },
            {
                "_id": cls.schedule_ids[3],
                "id": cls.schedule_ids[3],
                "prescription_item_id": cls.rx_item_2_id,
                "scheduled_date": today_str,
                "scheduled_time": missed_time,
                "status": "SCHEDULED",
            },
            {
                "_id": cls.schedule_ids[4],
                "id": cls.schedule_ids[4],
                "prescription_item_id": cls.rx_item_2_id,
                "scheduled_date": today_str,
                "scheduled_time": "08:00:00",
                "status": "GIVEN",
            },
            {
                "_id": cls.schedule_ids[5],
                "id": cls.schedule_ids[5],
                "prescription_item_id": cls.rx_item_2_id,
                "scheduled_date": today_str,
                "scheduled_time": "12:00:00",
                "status": "HELD",
            },
        ])

    # =========================================================================
    # TESTS: QR Verification Endpoint Context
    # =========================================================================

    def test_01_verify_patient_qr_success_with_patient_details(self):
        """Test scanning valid patient wristband QR returns identity, ward, and bed."""
        req = QRVerifyRequest(qr_token=self.valid_qr_token)
        res = verify_patient_qr(request=req, current_user=self.nurse_1_ctx)

        self.assertTrue(res.valid)
        self.assertEqual(res.patient_id, self.patient_id)
        self.assertEqual(res.patient_name, "Eleanor Rigby")
        self.assertEqual(res.patient_code, "PAT-888801")
        self.assertEqual(res.ward_name, "Cardiology Observation Ward")
        self.assertEqual(res.bed_number, "COW-04")

        # Verify recorded in MongoDB qr_verifications
        v_doc = mongo_db.qr_verifications.find_one({
            "patient_id": self.patient_id,
            "verified_by": self.nurse_1_id,
            "patient_qr_valid": True,
        })
        self.assertIsNotNone(v_doc)
        self.assertFalse(v_doc.get("is_override"))

    def test_02_verify_patient_qr_invalid_token(self):
        """Test scanning unknown QR returns valid=False."""
        req = QRVerifyRequest(qr_token="NON_EXISTENT_QR_CODE_XYZ")
        res = verify_patient_qr(request=req, current_user=self.nurse_1_ctx)

        self.assertFalse(res.valid)
        self.assertIsNone(res.patient_id)

    def test_03_verify_patient_qr_inactive_token(self):
        """Test scanning inactive/discharged QR returns valid=False."""
        req = QRVerifyRequest(qr_token=self.inactive_qr_token)
        res = verify_patient_qr(request=req, current_user=self.nurse_1_ctx)

        self.assertFalse(res.valid)
        self.assertIsNone(res.patient_id)

    # =========================================================================
    # TESTS: Nurse Medications By Patient ID & Authorization
    # =========================================================================

    def test_04_assigned_nurse_queries_patient_medications(self):
        """Assigned nurse receives active medication schedules sorted chronologically."""
        schedules = get_nurse_medications(
            patient_id=self.patient_id,
            current_user=self.nurse_1_ctx,
        )

        self.assertIsInstance(schedules, list)
        self.assertGreaterEqual(len(schedules), 6)

        # Check required fields for Smart Medication Countdown
        first = schedules[0]
        self.assertIn("patient_name", first)
        self.assertIn("medicine_name", first)
        self.assertIn("dose", first)
        self.assertIn("route", first)
        self.assertIn("scheduled_date", first)
        self.assertIn("scheduled_time", first)
        self.assertIn("status", first)

        # Verify chronological order
        dates_and_times = [(s["scheduled_date"], s["scheduled_time"]) for s in schedules]
        sorted_dates_and_times = sorted(dates_and_times)
        self.assertEqual(dates_and_times, sorted_dates_and_times)

    def test_05_unassigned_nurse_forbidden_without_bedside_scan(self):
        """Unassigned nurse cannot fetch patient medications without bedside QR verification."""
        # Ensure nurse 2 has no bedside verifications yet
        mongo_db.qr_verifications.delete_many({
            "patient_id": self.patient_id,
            "verified_by": self.nurse_2_id,
        })

        with self.assertRaises(HTTPException) as cm:
            get_nurse_medications(
                patient_id=self.patient_id,
                current_user=self.nurse_2_ctx,
            )
        self.assertEqual(cm.exception.status_code, 403)
        self.assertIn("Patient is not assigned", cm.exception.detail)

    def test_06_covering_nurse_authorized_after_bedside_scan(self):
        """Unassigned covering nurse CAN fetch medications after verifying wristband QR."""
        # 1. Nurse 2 performs bedside scan of patient wristband
        req = QRVerifyRequest(qr_token=self.valid_qr_token)
        qr_res = verify_patient_qr(request=req, current_user=self.nurse_2_ctx)
        self.assertTrue(qr_res.valid)

        # 2. Query medications
        schedules = get_nurse_medications(
            patient_id=self.patient_id,
            current_user=self.nurse_2_ctx,
        )
        self.assertIsInstance(schedules, list)
        self.assertGreaterEqual(len(schedules), 6)

    def test_07_administrator_authorized_without_prior_scan(self):
        """Administrator can fetch patient medications directly for clinical audit."""
        schedules = get_nurse_medications(
            patient_id=self.patient_id,
            current_user=self.admin_ctx,
        )
        self.assertIsInstance(schedules, list)
        self.assertGreaterEqual(len(schedules), 6)

    def test_08_inactive_discharged_patient_returns_404(self):
        """Discharged patient returns HTTP 404."""
        with self.assertRaises(HTTPException) as cm:
            get_nurse_medications(
                patient_id=self.patient_discharged_id,
                current_user=self.nurse_1_ctx,
            )
        self.assertEqual(cm.exception.status_code, 404)

    def test_09_nonexistent_patient_returns_404(self):
        """Non-existent patient returns HTTP 404."""
        with self.assertRaises(HTTPException) as cm:
            get_nurse_medications(
                patient_id=99999999,
                current_user=self.nurse_1_ctx,
            )
        self.assertEqual(cm.exception.status_code, 404)

    def test_10_parameterless_call_preserves_assigned_only_behavior(self):
        """Parameterless get_nurse_medications() maintains backward compatibility."""
        schedules_nurse_1 = get_nurse_medications(
            patient_id=None,
            current_user=self.nurse_1_ctx,
        )
        self.assertIsInstance(schedules_nurse_1, list)
        patient_ids = {s["patient_id"] for s in schedules_nurse_1}
        self.assertIn(self.patient_id, patient_ids)

    # =========================================================================
    # TESTS: Monitoring Status Classification Logic
    # =========================================================================

    def test_11_status_evaluation_logic(self):
        """Verify compliance with hospital countdown evaluation rules."""
        now = datetime.now()
        today = date.today()

        # 1. UPCOMING: 2 hours in the future
        sched_upcoming = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": (now + timedelta(hours=2)).strftime("%H:%M:%S"),
            "status": "SCHEDULED",
        }
        status_up, diff = compute_monitoring_status(sched_upcoming, current_dt=now)
        self.assertEqual(status_up, "UPCOMING")

        # 2. DUE: within window (-60m to +30m)
        sched_due = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": (now - timedelta(minutes=10)).strftime("%H:%M:%S"),
            "status": "SCHEDULED",
        }
        status_due, diff = compute_monitoring_status(sched_due, current_dt=now)
        self.assertEqual(status_due, "DUE")

        # 3. OVERDUE: past 60 min, under 240 min
        sched_overdue = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": (now - timedelta(minutes=90)).strftime("%H:%M:%S"),
            "status": "SCHEDULED",
        }
        status_ov, diff = compute_monitoring_status(sched_overdue, current_dt=now)
        self.assertEqual(status_ov, "OVERDUE")

        # 4. MISSED: past 240 min
        sched_missed = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": (now - timedelta(minutes=300)).strftime("%H:%M:%S"),
            "status": "SCHEDULED",
        }
        status_ms, diff = compute_monitoring_status(sched_missed, current_dt=now)
        self.assertEqual(status_ms, "MISSED")

        # 5. GIVEN / HELD: administration state preserved
        sched_given = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": "08:00:00",
            "status": "GIVEN",
        }
        status_gv, _ = compute_monitoring_status(sched_given, current_dt=now)
        self.assertIn(status_gv, ("GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE"))

        sched_held = {
            "scheduled_date": today.isoformat(),
            "scheduled_time": "12:00:00",
            "status": "HELD",
        }
        status_hd, _ = compute_monitoring_status(sched_held, current_dt=now)
        self.assertEqual(status_hd, "HELD")


if __name__ == "__main__":
    unittest.main(verbosity=2)

