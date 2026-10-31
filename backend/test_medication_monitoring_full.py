import unittest
from datetime import datetime, date, time, timedelta, timezone
from app.mongo_client import mongo_db, next_mongo_id
from app.services.medication_monitoring_service import (
    get_hospital_policy,
    compute_monitoring_status,
    get_monitoring_dashboard,
    get_compliance_reports,
    sync_medication_alerts,
)
from types import SimpleNamespace


class TestMedicationMonitoringSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an isolated test patient
        cls.test_patient_id = 999901
        cls.test_nurse_1_id = 999911
        cls.test_nurse_2_id = 999912  # For override testing
        cls.test_unauth_user_id = 999913

        # Cleanup any previous test data
        cls.cleanup_test_data()

        # Insert test users
        mongo_db.users.insert_many([
            {
                "_id": cls.test_nurse_1_id,
                "id": cls.test_nurse_1_id,
                "username": "test_nurse_alpha",
                "full_name": "Nurse Alpha (Assigned)",
                "role_id": 2, # Nurse
                "is_active": True,
            },
            {
                "_id": cls.test_nurse_2_id,
                "id": cls.test_nurse_2_id,
                "username": "test_nurse_beta",
                "full_name": "Nurse Beta (Covering)",
                "role_id": 2, # Nurse
                "is_active": True,
            },
            {
                "_id": cls.test_unauth_user_id,
                "id": cls.test_unauth_user_id,
                "username": "test_unauth_user",
                "full_name": "Unauthorized User",
                "role_id": 5, # Receptionist / no admin rights
                "is_active": True,
            },
        ])

        # Insert test patient
        mongo_db.patients.insert_one({
            "_id": cls.test_patient_id,
            "id": cls.test_patient_id,
            "patient_id": "TEST-PAT-9901",
            "first_name": "Isolated",
            "last_name": "MonitoringTestPatient",
            "ward_name": "Cardio Ward 4A",
            "is_active": True,
        })

        # Insert test assignment (Nurse 1 -> Patient)
        mongo_db.nurse_patient_assignments.insert_one({
            "_id": 999981,
            "id": 999981,
            "nurse_id": cls.test_nurse_1_id,
            "patient_id": cls.test_patient_id,
            "is_active": True,
        })

        # Insert test prescription & item
        cls.test_prescription_id = 999921
        cls.test_item_id = 999931
        cls.test_medicine_id = 999941

        mongo_db.medicines.insert_one({
            "_id": cls.test_medicine_id,
            "id": cls.test_medicine_id,
            "name": "Test Atenolol 50mg",
        })

        mongo_db.prescriptions.insert_one({
            "_id": cls.test_prescription_id,
            "id": cls.test_prescription_id,
            "patient_id": cls.test_patient_id,
            "is_active": True,
        })

        mongo_db.prescription_items.insert_one({
            "_id": cls.test_item_id,
            "id": cls.test_item_id,
            "prescription_id": cls.test_prescription_id,
            "medicine_id": cls.test_medicine_id,
            "dose": "50 mg",
            "route": "Oral",
            "frequency": "ONCE_DAILY",
            "is_stat": False,
        })

    @classmethod
    def tearDownClass(cls):
        cls.cleanup_test_data()

    @classmethod
    def cleanup_test_data(cls):
        mongo_db.users.delete_many({"_id": {"$in": [cls.test_nurse_1_id, cls.test_nurse_2_id, cls.test_unauth_user_id]}})
        mongo_db.patients.delete_many({"_id": cls.test_patient_id})
        mongo_db.nurse_patient_assignments.delete_many({"patient_id": cls.test_patient_id})
        mongo_db.medicines.delete_many({"_id": getattr(cls, "test_medicine_id", 999941)})
        mongo_db.prescriptions.delete_many({"_id": getattr(cls, "test_prescription_id", 999921)})
        mongo_db.prescription_items.delete_many({"_id": getattr(cls, "test_item_id", 999931)})
        mongo_db.medication_schedules.delete_many({"prescription_item_id": getattr(cls, "test_item_id", 999931)})
        mongo_db.medication_administrations.delete_many({"patient_id": cls.test_patient_id})
        mongo_db.medication_alerts.delete_many({"patient_id": cls.test_patient_id})
        mongo_db.qr_verifications.delete_many({"patient_id": cls.test_patient_id})

    def test_01_medication_administered_on_time(self):
        """Test 1: Medication administered within approved grace window -> GIVEN_ON_TIME"""
        schedule = {
            "scheduled_date": "2026-10-31",
            "scheduled_time": "10:00:00",
            "actual_administration_time": "2026-10-31 10:25:00",
            "status": "GIVEN",
        }
        status, delay = compute_monitoring_status(schedule)
        self.assertEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(delay, 25.0)

    def test_02_medication_administered_late(self):
        """Test 2: Medication administered past grace window (e.g. +75 min) -> GIVEN_LATE"""
        schedule = {
            "scheduled_date": "2026-10-31",
            "scheduled_time": "10:00:00",
            "actual_administration_time": "2026-10-31 11:15:00",
            "status": "GIVEN",
        }
        status, delay = compute_monitoring_status(schedule)
        self.assertEqual(status, "GIVEN_LATE")
        self.assertEqual(delay, 75.0)

    def test_03_medication_not_administered_due_and_overdue(self):
        """Test 3: Unadministered schedule calculation (UPCOMING, DUE, OVERDUE, MISSED)"""
        # Scheduled at 14:00. Evaluate at 13:00 -> UPCOMING
        status, _ = compute_monitoring_status(
            {"scheduled_date": "2026-10-31", "scheduled_time": "14:00:00"},
            current_dt=datetime(2026, 10, 31, 13, 0, 0),
        )
        self.assertEqual(status, "UPCOMING")

        # Scheduled at 14:00. Evaluate at 14:15 -> DUE
        status, _ = compute_monitoring_status(
            {"scheduled_date": "2026-10-31", "scheduled_time": "14:00:00"},
            current_dt=datetime(2026, 10, 31, 14, 15, 0),
        )
        self.assertEqual(status, "DUE")

        # Scheduled at 14:00. Evaluate at 15:30 (+90m) -> OVERDUE
        status, _ = compute_monitoring_status(
            {"scheduled_date": "2026-10-31", "scheduled_time": "14:00:00"},
            current_dt=datetime(2026, 10, 31, 15, 30, 0),
        )
        self.assertEqual(status, "OVERDUE")

        # Scheduled at 14:00. Evaluate at 19:00 (+300m) -> MISSED
        status, _ = compute_monitoring_status(
            {"scheduled_date": "2026-10-31", "scheduled_time": "14:00:00"},
            current_dt=datetime(2026, 10, 31, 19, 0, 0),
        )
        self.assertEqual(status, "MISSED")

    def test_04_medication_held(self):
        """Test 4: Medication marked HELD by clinician"""
        schedule = {
            "scheduled_date": "2026-10-31",
            "scheduled_time": "10:00:00",
            "status": "HELD",
        }
        status, _ = compute_monitoring_status(schedule)
        self.assertEqual(status, "HELD")

    def test_05_medication_refused_and_not_given(self):
        """Test 5: Medication marked REFUSED or NOT_GIVEN"""
        status_ref, _ = compute_monitoring_status({"status": "REFUSED"})
        self.assertEqual(status_ref, "REFUSED")

        status_ng, _ = compute_monitoring_status({"status": "NOT_GIVEN"})
        self.assertEqual(status_ng, "NOT_GIVEN")

    def test_06_administer_by_other_nurse_override(self):
        """Test 6: Authorized nurse overrides and administers medication with reason"""
        from app.routes.nurse import administer_medication
        from app.schemas.administration import MedicationAdministrationCreate

        # Create schedule for test patient
        test_sched_id = 999951
        mongo_db.medication_schedules.insert_one({
            "_id": test_sched_id,
            "id": test_sched_id,
            "prescription_item_id": self.test_item_id,
            "scheduled_date": "2026-10-31",
            "scheduled_time": "09:00:00",
            "status": "UPCOMING",
        })

        # Insert QR verification by Nurse 2
        mongo_db.qr_verifications.insert_one({
            "_id": 999961,
            "id": 999961,
            "medication_schedule_id": test_sched_id,
            "patient_id": self.test_patient_id,
            "verified_by": self.test_nurse_2_id,
            "patient_qr_valid": True,
            "medication_valid": True,
            "result": "SUCCESS",
        })

        # Nurse 2 administers with override reason
        nurse_2_user = SimpleNamespace(
            id=self.test_nurse_2_id,
            username="test_nurse_beta",
            full_name="Nurse Beta (Covering)",
        )

        req = MedicationAdministrationCreate(
            status="GIVEN",
            administered_at=datetime(2026, 10, 31, 9, 10, 0),
            notes="Covering while Nurse Alpha attends code blue",
            is_override=True,
            override_reason="Primary nurse on code blue response",
        )

        result = administer_medication(
            schedule_id=test_sched_id,
            request=req,
            current_user=nurse_2_user,
        )

        self.assertEqual(result["status"], "GIVEN_ON_TIME")
        self.assertTrue(result["is_override"])
        self.assertEqual(result["originally_assigned_nurse_id"], self.test_nurse_1_id)
        self.assertEqual(result["override_reason"], "Primary nurse on code blue response")

        # Verify DB record has complete accountability fields
        adm = mongo_db.medication_administrations.find_one({"medication_schedule_id": test_sched_id})
        self.assertIsNotNone(adm)
        self.assertEqual(adm["administered_by"], self.test_nurse_2_id)
        self.assertEqual(adm["nurse_name"], "Nurse Beta (Covering)")
        self.assertEqual(adm["originally_assigned_nurse_id"], self.test_nurse_1_id)
        self.assertEqual(adm["is_override"], True)

    def test_07_unauthorized_override_without_reason(self):
        """Test 7: Unassigned nurse attempting administration without override reason -> Rejected"""
        from app.routes.nurse import administer_medication
        from app.schemas.administration import MedicationAdministrationCreate
        from fastapi import HTTPException

        test_sched_id = 999952
        mongo_db.medication_schedules.insert_one({
            "_id": test_sched_id,
            "id": test_sched_id,
            "prescription_item_id": self.test_item_id,
            "scheduled_date": "2026-10-31",
            "scheduled_time": "10:00:00",
            "status": "UPCOMING",
        })

        mongo_db.qr_verifications.insert_one({
            "_id": 999962,
            "id": 999962,
            "medication_schedule_id": test_sched_id,
            "patient_id": self.test_patient_id,
            "verified_by": self.test_nurse_2_id,
            "patient_qr_valid": True,
            "medication_valid": True,
            "result": "SUCCESS",
        })

        nurse_2_user = SimpleNamespace(
            id=self.test_nurse_2_id,
            username="test_nurse_beta",
            full_name="Nurse Beta (Covering)",
        )

        # Missing override reason
        req = MedicationAdministrationCreate(
            status="GIVEN",
            override_reason="",
        )

        with self.assertRaises(HTTPException) as ctx:
            administer_medication(
                schedule_id=test_sched_id,
                request=req,
                current_user=nurse_2_user,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("override reason is required", ctx.exception.detail)

    def test_08_duplicate_administration_attempts(self):
        """Test 8: Duplicate administration attempt on already administered dose -> 409 Rejected"""
        from app.routes.nurse import administer_medication
        from app.schemas.administration import MedicationAdministrationCreate
        from fastapi import HTTPException

        test_sched_id = 999951  # Already administered in test_06
        nurse_1_user = SimpleNamespace(
            id=self.test_nurse_1_id,
            username="test_nurse_alpha",
            full_name="Nurse Alpha (Assigned)",
        )

        req = MedicationAdministrationCreate(status="GIVEN")

        with self.assertRaises(HTTPException) as ctx:
            administer_medication(
                schedule_id=test_sched_id,
                request=req,
                current_user=nurse_1_user,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_09_overdue_alerts_sync(self):
        """Test 9: Overdue and missed alerts generation without duplicates"""
        test_sched_id = 999953
        mongo_db.medication_schedules.insert_one({
            "_id": test_sched_id,
            "id": test_sched_id,
            "prescription_item_id": self.test_item_id,
            "scheduled_date": "2026-10-31",
            "scheduled_time": "06:00:00",  # Far in the past today -> MISSED
            "status": "UPCOMING",
        })

        alerts_1 = sync_medication_alerts()
        # Verify alert created for test_sched_id
        alert = mongo_db.medication_alerts.find_one({"medication_schedule_id": test_sched_id})
        self.assertIsNotNone(alert)
        self.assertEqual(alert["alert_type"], "MISSED")

        # Second sync must NOT create duplicate alert
        count_before = mongo_db.medication_alerts.count_documents({"medication_schedule_id": test_sched_id})
        sync_medication_alerts()
        count_after = mongo_db.medication_alerts.count_documents({"medication_schedule_id": test_sched_id})
        self.assertEqual(count_before, count_after)

    def test_10_admin_dashboard_statistics(self):
        """Test 10: Admin dashboard statistics and filter retrieval"""
        dashboard = get_monitoring_dashboard(patient_filter="MonitoringTestPatient")
        self.assertGreaterEqual(len(dashboard["schedules"]), 1)
        self.assertIn("counts", dashboard)
        self.assertIn("metrics", dashboard)
        self.assertIn("on_time_rate", dashboard["metrics"])

    def test_11_nurse_dashboard_queue(self):
        """Test 11: Nurse queue includes monitoring_status and assignment metadata"""
        from app.routes.nurse import get_nurse_medications
        nurse_1_user = SimpleNamespace(
            id=self.test_nurse_1_id,
            username="test_nurse_alpha",
            full_name="Nurse Alpha (Assigned)",
        )
        queue = get_nurse_medications(current_user=nurse_1_user)
        test_items = [q for q in queue if q.get("patient_id") == self.test_patient_id]
        self.assertGreaterEqual(len(test_items), 1)
        self.assertIn("monitoring_status", test_items[0])
        self.assertTrue(test_items[0]["is_assigned"])

    def test_12_administration_history(self):
        """Test 12: Nurse administration history accurately logs events"""
        from app.routes.nurse import get_nurse_history
        nurse_2_user = SimpleNamespace(
            id=self.test_nurse_2_id,
            username="test_nurse_beta",
            full_name="Nurse Beta (Covering)",
        )
        history = get_nurse_history(current_user=nurse_2_user)
        self.assertGreaterEqual(len(history), 1)
        self.assertEqual(history[0]["administered_by"], self.test_nurse_2_id)
        self.assertTrue(history[0]["is_override"])


if __name__ == "__main__":
    unittest.main()
