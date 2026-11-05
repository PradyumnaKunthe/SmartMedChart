"""
End-to-End Test Suite for SmartMedChart:
1. BUG 1 — Automatic Administration Status Detection (On-Time, Late, Early, Non-Admin)
2. BUG 2 — Medication Loading Resilience (Integer, String, ObjectId identifiers, context resolution, fallback)
"""

import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from bson import ObjectId

# Setup imports
import app.mongo_client as mc
from app.services.medication_monitoring_service import (
    compute_monitoring_status,
    get_hospital_policy,
    parse_iso_or_sql_datetime,
    parse_schedule_datetime,
)
from app.routes.nurse import (
    _get_id_candidates,
    _by_id,
    _schedule_context,
    _get_nurse_schedule,
    administer_medication,
    get_medication,
)
from app.schemas.administration import MedicationAdministrationCreate


class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []

    def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = len(self.docs) + 1
        self.docs.append(d)
        return SimpleNamespace(inserted_id=d["_id"])

    def insert_many(self, docs):
        res = []
        for d in docs:
            r = self.insert_one(d)
            res.append(r.inserted_id)
        return SimpleNamespace(inserted_ids=res)

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, branch) for branch in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, branch) for branch in v):
                    return False
            else:
                doc_val = doc.get(k)
                if isinstance(v, dict):
                    if "$in" in v:
                        v_in = v["$in"]
                        cand_strs = [str(x) for x in v_in]
                        if str(doc_val) not in cand_strs and doc_val not in v_in:
                            return False
                    elif "$nin" in v:
                        if doc_val in v["$nin"] or str(doc_val) in [str(x) for x in v["$nin"]]:
                            return False
                    elif "$ne" in v:
                        if doc_val == v["$ne"] or str(doc_val) == str(v["$ne"]):
                            return False
                else:
                    if str(doc_val) != str(v) and doc_val != v:
                        return False
        return True

    def find_one(self, filter=None, sort=None):
        matches = [d for d in self.docs if self._matches(d, filter)]
        if not matches:
            return None
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda x: x.get(key, 0), reverse=(direction == -1))
        return dict(matches[0])

    def find(self, filter=None, projection=None):
        matches = [dict(d) for d in self.docs if self._matches(d, filter)]
        class Cursor(list):
            def sort(self, sort_keys):
                res = list(self)
                for key, direction in reversed(sort_keys):
                    res.sort(key=lambda x: str(x.get(key, "")), reverse=(direction == -1))
                return Cursor(res)
            def limit(self, n):
                return Cursor(self[:n])
        return Cursor(matches)

    def update_one(self, filter, update, upsert=False):
        for d in self.docs:
            if self._matches(d, filter):
                if "$set" in update:
                    d.update(update["$set"])
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        d[ik] = d.get(ik, 0) + iv
                return SimpleNamespace(matched_count=1, modified_count=1)
        if upsert:
            new_doc = {}
            if "$set" in update:
                new_doc.update(update["$set"])
            for k, v in filter.items():
                if not k.startswith("$"):
                    new_doc[k] = v
            self.docs.append(new_doc)
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=new_doc.get("_id"))
        return SimpleNamespace(matched_count=0, modified_count=0)

    def update_many(self, filter, update):
        cnt = 0
        for d in self.docs:
            if self._matches(d, filter):
                if "$set" in update:
                    d.update(update["$set"])
                cnt += 1
        return SimpleNamespace(matched_count=cnt, modified_count=cnt)

    def find_one_and_update(self, filter, update, return_document=None):
        for d in self.docs:
            if self._matches(d, filter):
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        d[ik] = d.get(ik, 0) + iv
                return dict(d)
        new_d = dict(filter)
        if "$inc" in update:
            for ik, iv in update["$inc"].items():
                new_d[ik] = iv
        self.docs.append(new_d)
        return dict(new_d)

    def delete_one(self, filter):
        for i, d in enumerate(self.docs):
            if self._matches(d, filter):
                del self.docs[i]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def delete_many(self, filter):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, filter)]
        return SimpleNamespace(deleted_count=before - len(self.docs))

    def count_documents(self, filter):
        return len([d for d in self.docs if self._matches(d, filter)])


class MockMongoDatabase:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getitem__(self, name):
        return getattr(self, name)


class TestAutomaticStatusAndMedicationLoading(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Swap with mock in-memory DB for offline reliability
        cls.orig_mongo_db = mc.mongo_db
        cls.mock_db = MockMongoDatabase()
        mc.mongo_db = cls.mock_db

        import app.routes.nurse as nurse_mod
        import app.services.medication_monitoring_service as mms_mod
        nurse_mod.mongo_db = cls.mock_db
        mms_mod.mongo_db = cls.mock_db

        cls.test_nurse_id = 998811
        cls.test_patient_id = 998821
        cls.test_patient_code = "SMH-TEST-998821"
        cls.test_prescription_id = 998831
        cls.test_item_id = 998841
        cls.test_medicine_id = 998851
        cls.test_schedule_id = 998861

        # Seed nurse
        cls.mock_db.users.insert_one({
            "_id": cls.test_nurse_id,
            "id": cls.test_nurse_id,
            "username": "nurse_auto_test",
            "full_name": "Nurse Auto Tester",
            "role_id": 2,
            "is_active": True,
        })

        # Seed patient
        cls.mock_db.patients.insert_one({
            "_id": cls.test_patient_id,
            "id": cls.test_patient_id,
            "patient_id": cls.test_patient_code,
            "first_name": "AutoTest",
            "last_name": "Inpatient",
            "ward_name": "ICU Ward 2",
            "is_active": True,
            "lifecycle_status": "ADMITTED",
        })

        # Seed nurse patient assignment
        cls.mock_db.nurse_patient_assignments.insert_one({
            "_id": 998871,
            "id": 998871,
            "nurse_id": cls.test_nurse_id,
            "patient_id": cls.test_patient_id,
            "is_active": True,
        })

        # Seed medicine
        cls.mock_db.medicines.insert_one({
            "_id": cls.test_medicine_id,
            "id": cls.test_medicine_id,
            "name": "Ceftriaxone 1g",
            "generic_name": "Ceftriaxone Sodium",
            "strength": "1 g",
            "dosage_form": "Injection",
            "is_active": 1,
        })

        # Seed prescription
        cls.mock_db.prescriptions.insert_one({
            "_id": cls.test_prescription_id,
            "id": cls.test_prescription_id,
            "patient_id": cls.test_patient_id,
            "doctor_id": 1,
            "status": "ACTIVE",
        })

        # Seed prescription item
        cls.mock_db.prescription_items.insert_one({
            "_id": cls.test_item_id,
            "id": cls.test_item_id,
            "prescription_id": cls.test_prescription_id,
            "medicine_id": cls.test_medicine_id,
            "dose": "1 g",
            "route": "IV",
            "frequency": "ONCE_DAILY",
            "status": "ACTIVE",
            "is_stat": False,
        })

    @classmethod
    def tearDownClass(cls):
        mc.mongo_db = cls.orig_mongo_db

    # =========================================================
    # BUG 1 TESTS: AUTOMATIC STATUS DETECTION
    # =========================================================

    def test_01_automatic_status_on_time_within_grace(self):
        """Doses given between -30m and +60m must be classified as GIVEN_ON_TIME."""
        policy = get_hospital_policy()
        sched = {
            "scheduled_date": "2026-11-05",
            "scheduled_time": "10:00:00",
            "status": "GIVEN",
        }

        # Subtest 1: exactly on time
        sched["actual_administration_time"] = "2026-11-05 10:00:00"
        status, delay = compute_monitoring_status(sched, policy=policy)
        self.assertEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(delay, 0.0)

        # Subtest 2: given 25 minutes before scheduled time (within -30m pre-dose window)
        sched["actual_administration_time"] = "2026-11-05 09:35:00"
        status, delay = compute_monitoring_status(sched, policy=policy)
        self.assertEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(delay, -25.0)

        # Subtest 3: given 45 minutes after scheduled time (within +60m grace window)
        sched["actual_administration_time"] = "2026-11-05 10:45:00"
        status, delay = compute_monitoring_status(sched, policy=policy)
        self.assertEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(delay, 45.0)

    def test_02_automatic_status_late_past_grace(self):
        """Doses given after 60m must be automatically classified as GIVEN_LATE."""
        policy = get_hospital_policy()
        sched = {
            "scheduled_date": "2026-11-05",
            "scheduled_time": "10:00:00",
            "actual_administration_time": "2026-11-05 11:20:00",  # +80m
            "status": "GIVEN",
        }
        status, delay = compute_monitoring_status(sched, policy=policy)
        self.assertEqual(status, "GIVEN_LATE")
        self.assertEqual(delay, 80.0)

    def test_03_automatic_status_early_before_window_not_on_time(self):
        """Doses given before the pre-dose window (> 30m early) must NOT be classified as on-time."""
        policy = get_hospital_policy()
        sched = {
            "scheduled_date": "2026-11-05",
            "scheduled_time": "10:00:00",
            "actual_administration_time": "2026-11-05 09:10:00",  # -50m early
            "status": "GIVEN",
        }
        status, delay = compute_monitoring_status(sched, policy=policy)
        self.assertNotEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(status, "GIVEN_EARLY")
        self.assertEqual(delay, -50.0)

    def test_04_clinical_non_administration_statuses_preserved(self):
        """HELD, REFUSED, and NOT_GIVEN must be strictly preserved without being marked as GIVEN."""
        policy = get_hospital_policy()
        for clinical_status in ("HELD", "REFUSED", "NOT_GIVEN"):
            sched = {
                "scheduled_date": "2026-11-05",
                "scheduled_time": "10:00:00",
                "actual_administration_time": "2026-11-05 10:05:00",
                "status": clinical_status,
            }
            status, delay = compute_monitoring_status(sched, policy=policy)
            self.assertEqual(status, clinical_status)
            self.assertEqual(delay, 0.0)

    def test_05_utc_server_timestamp_converted_to_hospital_timezone(self):
        """When actual_administration_time has UTC timezone info, it must properly map to hospital IST."""
        # Schedule at 14:00:00 IST
        sched = {
            "scheduled_date": "2026-11-05",
            "scheduled_time": "14:00:00",
            "status": "GIVEN",
        }

        # Administered at 08:30:00 UTC (which is 14:00:00 IST)
        admin_utc = datetime(2026, 11, 5, 8, 30, 0, tzinfo=timezone.utc)
        sched["actual_administration_time"] = admin_utc.isoformat()

        status, delay = compute_monitoring_status(sched)
        self.assertEqual(status, "GIVEN_ON_TIME")
        self.assertEqual(delay, 0.0)

    # =========================================================
    # BUG 2 TESTS: MEDICATION LOADING & ID RESILIENCE
    # =========================================================

    def test_06_id_candidates_helper_handles_all_types(self):
        """_get_id_candidates must produce int, str, and ObjectId appropriately."""
        # Int
        self.assertIn(42, _get_id_candidates(42))
        self.assertIn("42", _get_id_candidates(42))

        # String int
        self.assertIn(42, _get_id_candidates("42"))
        self.assertIn("42", _get_id_candidates("42"))

        # 24-character hex ObjectId
        hex_id = "507f1f77bcf86cd799439011"
        candidates = _get_id_candidates(hex_id)
        self.assertIn(hex_id, candidates)
        self.assertTrue(any(isinstance(c, ObjectId) for c in candidates))

    def test_07_schedule_lookup_with_string_id(self):
        """_get_nurse_schedule and get_medication must resolve string IDs properly."""
        sched_id = 998862
        self.mock_db.medication_schedules.insert_one({
            "_id": sched_id,
            "id": sched_id,
            "prescription_item_id": self.test_item_id,
            "prescription_id": self.test_prescription_id,
            "patient_id": self.test_patient_id,
            "medicine_id": self.test_medicine_id,
            "medicine_name": "Ceftriaxone 1g",
            "scheduled_date": "2026-11-05",
            "scheduled_time": "12:00:00",
            "status": "SCHEDULED",
        })

        nurse_user = SimpleNamespace(
            id=self.test_nurse_id,
            username="nurse_auto_test",
            full_name="Nurse Auto Tester",
        )

        # Lookup with string id "998862"
        res = get_medication(schedule_id=str(sched_id), current_user=nurse_user)
        res_id = res.id if hasattr(res, "id") else res["id"]
        res_pat = res.patient_name if hasattr(res, "patient_name") else res["patient_name"]
        res_med = res.medicine_name if hasattr(res, "medicine_name") else res["medicine_name"]
        self.assertEqual(str(res_id), str(sched_id))
        self.assertEqual(res_pat, "AutoTest Inpatient")
        self.assertEqual(res_med, "Ceftriaxone 1g")

    def test_08_fallback_context_resolution_when_item_missing(self):
        """If prescription_item_id document is missing, _schedule_context must recover from schedule metadata."""
        sched_id = 998863
        self.mock_db.medication_schedules.insert_one({
            "_id": sched_id,
            "id": sched_id,
            "prescription_item_id": 9999999,  # Non-existent item
            "prescription_id": self.test_prescription_id,
            "patient_id": self.test_patient_id,
            "medicine_id": self.test_medicine_id,
            "medicine_name": "Ceftriaxone 1g",
            "dose": "1 g",
            "route": "IV",
            "scheduled_date": "2026-11-05",
            "scheduled_time": "16:00:00",
            "status": "SCHEDULED",
        })

        sched = self.mock_db.medication_schedules.find_one({"_id": sched_id})
        context = _schedule_context(sched)
        self.assertIsNotNone(context)
        item, rx, patient, med = context
        self.assertEqual(patient["id"], self.test_patient_id)
        self.assertEqual(med["name"], "Ceftriaxone 1g")

    def test_09_full_bedside_administration_workflow(self):
        """Nurse marks dose as given -> backend automatically calculates GIVEN_ON_TIME and records accountability."""
        sched_id = 998864
        self.mock_db.medication_schedules.insert_one({
            "_id": sched_id,
            "id": sched_id,
            "prescription_item_id": self.test_item_id,
            "prescription_id": self.test_prescription_id,
            "patient_id": self.test_patient_id,
            "medicine_id": self.test_medicine_id,
            "medicine_name": "Ceftriaxone 1g",
            "scheduled_date": "2026-11-05",
            "scheduled_time": "10:00:00",
            "status": "SCHEDULED",
        })

        # Insert valid QR verification
        self.mock_db.qr_verifications.insert_one({
            "_id": 998891,
            "id": 998891,
            "patient_id": self.test_patient_id,
            "medication_schedule_id": sched_id,
            "verified_by": self.test_nurse_id,
            "patient_qr_valid": True,
            "medication_valid": True,
            "result": "SUCCESS",
        })

        nurse_user = SimpleNamespace(
            id=self.test_nurse_id,
            username="nurse_auto_test",
            full_name="Nurse Auto Tester",
        )

        # Nurse simply sends status="GIVEN"
        req = MedicationAdministrationCreate(
            status="GIVEN",
            administered_at=datetime(2026, 11, 5, 10, 15, 0),  # +15m -> within grace
            notes="Tolerated well without allergic reaction",
        )

        result = administer_medication(
            schedule_id=str(sched_id),
            request=req,
            current_user=nurse_user,
        )

        # Automatically calculated as GIVEN_ON_TIME
        self.assertEqual(result["status"], "GIVEN_ON_TIME")
        self.assertEqual(result["delay_minutes"], 15.0)
        self.assertEqual(result["administered_by"], self.test_nurse_id)
        self.assertEqual(result["nurse_name"], "Nurse Auto Tester")

        # Verify DB schedule update
        updated_sched = self.mock_db.medication_schedules.find_one({"_id": sched_id})
        self.assertEqual(updated_sched["status"], "GIVEN_ON_TIME")
        self.assertEqual(updated_sched["administered_by"], self.test_nurse_id)


if __name__ == "__main__":
    unittest.main()
