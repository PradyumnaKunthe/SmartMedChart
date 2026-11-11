"""
SmartMedChart – Comprehensive Six Security Vulnerabilities Verification Test Suite
Fully isolated in-memory verification for:
1. Vulnerability 1 (CRITICAL): Cross-Patient PHI Leakage Through AI Chatbot (chat.py)
2. Vulnerability 2 (HIGH): Perpetual QR Bedside Authorization (nurse_qr.py & nurse.py)
3. Vulnerability 3 (HIGH): Doctor Prescription BOLA / IDOR (doctor.py)
4. Vulnerability 4 (HIGH): Unverified Prescription-Linked Pharmacy Dispensing (pharmacy.py & medicine.py)
5. Vulnerability 5 (HIGH): Global Medication Alert Access & Unauthorized Acknowledgement (monitoring.py)
6. Vulnerability 6 (MEDIUM): Broad Patient Registration Privileges (hospital.py)
"""

import os
import sys
import unittest
from datetime import datetime, date, time, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Mock Collection and Database for isolated, non-network unit testing
class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []

    def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = len(self.docs) + 1
        if "id" not in d:
            d["id"] = d["_id"]
        self.docs.append(d)
        return SimpleNamespace(inserted_id=d["_id"])

    def insert_many(self, docs):
        res = []
        for d in docs:
            res.append(self.insert_one(d).inserted_id)
        return SimpleNamespace(inserted_ids=res)

    def find_one(self, query=None, sort=None, projection=None):
        if not query:
            return dict(self.docs[0]) if self.docs else None
        for d in self.docs:
            if self._matches(d, query):
                return dict(d)
        return None

    def find(self, query=None, projection=None):
        class MockCursor:
            def __init__(self, docs):
                self.docs = [dict(d) for d in docs]
            def sort(self, *args, **kwargs):
                return self
            def limit(self, n):
                self.docs = self.docs[:n]
                return self
            def __iter__(self):
                return iter(self.docs)
            def __len__(self):
                return len(self.docs)

        if not query:
            return MockCursor(self.docs)
        matching = [d for d in self.docs if self._matches(d, query)]
        return MockCursor(matching)

    def distinct(self, key, query=None):
        res = set()
        for d in self.docs:
            if query is None or self._matches(d, query):
                val = d.get(key)
                if val is not None:
                    res.add(val)
        return list(res)

    def count_documents(self, query=None):
        if not query:
            return len(self.docs)
        return sum(1 for d in self.docs if self._matches(d, query))

    def update_one(self, filter_query, update_query, upsert=False):
        for d in self.docs:
            if self._matches(d, filter_query):
                self._apply_update(d, update_query)
                return SimpleNamespace(matched_count=1, modified_count=1)
        if upsert:
            new_doc = dict(filter_query)
            self._apply_update(new_doc, update_query)
            self.insert_one(new_doc)
            return SimpleNamespace(matched_count=0, modified_count=1, upserted_id=new_doc.get("_id"))
        return SimpleNamespace(matched_count=0, modified_count=0)

    def update_many(self, filter_query, update_query):
        matched = 0
        for d in self.docs:
            if self._matches(d, filter_query):
                self._apply_update(d, update_query)
                matched += 1
        return SimpleNamespace(matched_count=matched, modified_count=matched)

    def find_one_and_update(self, filter_query, update_query, return_document=True, upsert=False):
        for d in self.docs:
            if self._matches(d, filter_query):
                self._apply_update(d, update_query)
                return dict(d)
        if upsert:
            new_doc = dict(filter_query)
            self._apply_update(new_doc, update_query)
            self.insert_one(new_doc)
            return dict(new_doc)
        return None

    def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                del self.docs[i]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        return SimpleNamespace(deleted_count=initial - len(self.docs))

    def _apply_update(self, doc, update_query):
        if "$set" in update_query:
            for k, v in update_query["$set"].items():
                doc[k] = v
        if "$inc" in update_query:
            for k, v in update_query["$inc"].items():
                doc[k] = doc.get(k, 0) + v
        if "$max" in update_query:
            for k, v in update_query["$max"].items():
                doc[k] = max(doc.get(k, 0), v)

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, subq) for subq in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, subq) for subq in v):
                    return False
            elif isinstance(v, dict):
                doc_val = doc.get(k)
                if "$in" in v:
                    if isinstance(doc_val, list):
                        if not any(x in v["$in"] for x in doc_val):
                            return False
                    elif doc_val not in v["$in"]:
                        return False
                if "$ne" in v and doc_val == v["$ne"]:
                    return False
                if "$gt" in v and not (doc_val is not None and doc_val > v["$gt"]):
                    return False
                if "$gte" in v and not (doc_val is not None and doc_val >= v["$gte"]):
                    return False
            else:
                doc_val = doc.get(k)
                if isinstance(doc_val, list) and not isinstance(v, list):
                    if v not in doc_val:
                        return False
                elif doc_val != v:
                    return False
        return True


class MockDatabase:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getitem__(self, name):
        return self.__getattr__(name)


# Instantiate isolated mock db
mock_db = MockDatabase()

# Patch mongo_db across all relevant modules before importing route handlers
import app.mongo_client as mc
mc.mongo_db = mock_db

import app.routes.chat as chat_module
chat_module.mongo_db = mock_db

import app.routes.nurse_qr as nurse_qr_module
nurse_qr_module.mongo_db = mock_db

import app.routes.nurse as nurse_module
nurse_module.mongo_db = mock_db

import app.routes.doctor as doctor_module
doctor_module.mongo_db = mock_db

import app.routes.pharmacy as pharmacy_module
pharmacy_module.mongo_db = mock_db

import app.routes.monitoring as monitoring_module
monitoring_module.mongo_db = mock_db

import app.routes.hospital as hospital_module
hospital_module.mongo_db = mock_db

import app.services.medication_monitoring_service as mms
mms.mongo_db = mock_db

import app.services.scheduling_service as ss
ss.mongo_db = mock_db

import app.services.notification_service as ns
ns.mongo_db = mock_db

from fastapi import HTTPException
from pydantic import ValidationError

from app.routes.chat import find_patient, build_patient_summary, get_authorized_patient_scope
from app.routes.nurse import administer_medication
from app.routes.doctor import (
    get_doctor_prescription_or_403,
    update_prescription,
    stop_prescription,
    replace_prescription,
    create_prescription,
)
from app.routes.pharmacy import dispense_medicine
from app.schemas.medicine import DispenseCreate
from app.routes.monitoring import get_alerts, acknowledge_alert
from app.schemas.administration import MedicationAlertAcknowledgeRequest, MedicationAdministrationCreate
from app.routes.hospital import require_patient_registration_permission
from app.schemas.prescription_update import PrescriptionUpdate


def make_test_user(role_name: str, user_id: int, username: str, permissions: list[str]):
    perms = [SimpleNamespace(name=p) for p in permissions]
    role = SimpleNamespace(
        id=user_id,
        name=role_name,
        permissions=perms,
    )
    return SimpleNamespace(
        id=user_id,
        username=username,
        full_name=f"{username.capitalize()}",
        role=role,
        role_name=role_name,
        permissions=permissions,
    )


class TestSixVulnerabilitiesRemediation(unittest.TestCase):
    def setUp(self):
        # Reset collections for each test
        global mock_db
        mock_db._collections.clear()

        for mod in (
            mc,
            chat_module,
            nurse_qr_module,
            nurse_module,
            doctor_module,
            pharmacy_module,
            monitoring_module,
            hospital_module,
            mms,
            ss,
            ns,
        ):
            mod.mongo_db = mock_db

        # Seed default hospital policy
        mock_db.hospital_policy.insert_one({
            "_id": "current",
            "on_time_grace_before_minutes": 30,
            "on_time_grace_after_minutes": 30,
            "late_window_hours": 2,
            "qr_freshness_minutes": 5,
        })

        self.doc_a = make_test_user("Doctor", 9001, "dr_alice", [
            "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "STOP_PRESCRIPTION", "VIEW_MEDICATION_HISTORY"
        ])
        self.doc_b = make_test_user("Doctor", 9002, "dr_bob", [
            "VIEW_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION", "STOP_PRESCRIPTION", "VIEW_MEDICATION_HISTORY"
        ])
        self.nurse_1 = make_test_user("Nurse", 9003, "nurse_carol", [
            "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "VERIFY_QR", "ADMINISTER_MEDICATION", "VIEW_MEDICATION_HISTORY"
        ])
        self.nurse_2 = make_test_user("Nurse", 9004, "nurse_dan", [
            "VIEW_PATIENT", "VIEW_MEDICATION_SCHEDULE", "VERIFY_QR", "ADMINISTER_MEDICATION", "VIEW_MEDICATION_HISTORY"
        ])
        self.receptionist = make_test_user("Receptionist", 9005, "rec_eva", [
            "VIEW_PATIENT", "REGISTER_PATIENT"
        ])
        self.pharmacist = make_test_user("Pharmacist", 9006, "pharm_frank", [
            "VIEW_PATIENT", "VIEW_PRESCRIPTION", "MANAGE_MEDICINE", "MANAGE_INVENTORY"
        ])
        self.admin = make_test_user("Administrator", 9007, "admin_grace", [
            "VIEW_PATIENT", "REGISTER_PATIENT", "CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION",
            "STOP_PRESCRIPTION", "MANAGE_MEDICINE", "MANAGE_INVENTORY", "MANAGE_USERS",
            "VIEW_REPORTS", "MANAGE_SYSTEM"
        ])

    # =========================================================================
    # 1. VULNERABILITY 1: CHATBOT PHI ISOLATION (backend/app/routes/chat.py)
    # =========================================================================

    def test_01_chatbot_scope_doctor_isolation(self):
        # Patient X assigned to Doc A, Patient Y assigned to Doc B
        p_x = {"_id": 9901, "id": 9901, "patient_id": "P9901", "first_name": "TestAlice", "last_name": "Patient", "is_active": True}
        p_y = {"_id": 9902, "id": 9902, "patient_id": "P9902", "first_name": "TestBob", "last_name": "Patient", "is_active": True}
        mock_db.patients.insert_one(p_x)
        mock_db.patients.insert_one(p_y)

        enc_x = {"_id": 9901, "id": 9901, "patient_id": 9901, "doctor_id": self.doc_a.id, "status": "ACTIVE"}
        enc_y = {"_id": 9902, "id": 9902, "patient_id": 9902, "doctor_id": self.doc_b.id, "status": "ACTIVE"}
        mock_db.encounters.insert_one(enc_x)
        mock_db.encounters.insert_one(enc_y)

        # Doc A queries assigned Patient X -> Allowed
        found = find_patient("What are TestAlice's medications?", self.doc_a)
        self.assertIsNotNone(found)
        self.assertFalse(isinstance(found, dict) and found.get("__unauthorized__"))
        self.assertEqual(found.get("id"), 9901)

        # Doc A queries unassigned Patient Y -> Blocked with __unauthorized__
        unauth = find_patient("Tell me about TestBob Patient", self.doc_a)
        self.assertTrue(isinstance(unauth, dict) and unauth.get("__unauthorized__"))

    def test_02_chatbot_scope_nurse_isolation(self):
        # Patient N1 assigned to Nurse Carol, Patient N2 unassigned
        p_n1 = {"_id": 9903, "id": 9903, "patient_id": "P9903", "first_name": "NurseAssigned", "last_name": "PatOne", "is_active": True}
        p_n2 = {"_id": 9904, "id": 9904, "patient_id": "P9904", "first_name": "NurseUnassigned", "last_name": "PatTwo", "is_active": True}
        mock_db.patients.insert_one(p_n1)
        mock_db.patients.insert_one(p_n2)

        assign = {"_id": 9903, "id": 9903, "patient_id": 9903, "nurse_id": self.nurse_1.id, "is_active": True}
        mock_db.nurse_patient_assignments.insert_one(assign)

        # Nurse Carol queries assigned patient -> Allowed
        res_assigned = find_patient("NurseAssigned", self.nurse_1)
        self.assertIsNotNone(res_assigned)
        self.assertEqual(res_assigned.get("id"), 9903)

        # Nurse Carol queries unassigned patient -> Blocked
        res_unassigned = find_patient("NurseUnassigned", self.nurse_1)
        self.assertTrue(isinstance(res_unassigned, dict) and res_unassigned.get("__unauthorized__"))

    def test_03_chatbot_receptionist_clinical_blackout(self):
        p_r = {"_id": 9905, "id": 9905, "patient_id": "P9905", "first_name": "Receptionist", "last_name": "CheckIn", "is_active": True}
        mock_db.patients.insert_one(p_r)

        summary = build_patient_summary(p_r, self.receptionist)
        self.assertIn("Restricted - Clinical Role Required", summary)
        self.assertIn("Receptionist CheckIn", summary)

    def test_04_chatbot_ambiguous_patient_search(self):
        p_a1 = {"_id": 9906, "id": 9906, "patient_id": "P9906", "first_name": "SameFirst", "last_name": "Smith", "is_active": True}
        p_a2 = {"_id": 9907, "id": 9907, "patient_id": "P9907", "first_name": "SameFirst", "last_name": "Jones", "is_active": True}
        mock_db.patients.insert_one(p_a1)
        mock_db.patients.insert_one(p_a2)

        # Ambiguous first name match -> __ambiguous__
        res_ambiguous = find_patient("What is the status of SameFirst?", self.admin)
        self.assertTrue(isinstance(res_ambiguous, dict) and res_ambiguous.get("__ambiguous__"))

    # =========================================================================
    # 2. VULNERABILITY 2: PERPETUAL QR AUTHORIZATION (nurse_qr.py & nurse.py)
    # =========================================================================

    def test_05_qr_freshness_within_window_allowed(self):
        now_dt = datetime.now(timezone.utc)
        qr_id = 9910
        sched_id = 9910
        item_id = 9910
        rx_id = 9910
        p_id = 9910

        p = {"_id": p_id, "id": p_id, "patient_id": "P9910", "first_name": "QRFresh", "last_name": "Patient", "is_active": True}
        mock_db.patients.insert_one(p)

        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "doctor_id": self.doc_a.id, "status": "ACTIVE"}
        mock_db.prescriptions.insert_one(rx)

        item = {"_id": item_id, "id": item_id, "prescription_id": rx_id, "medicine_id": 1, "dose": "500mg", "status": "ACTIVE"}
        mock_db.prescription_items.insert_one(item)

        sched = {
            "_id": sched_id, "id": sched_id, "prescription_item_id": item_id,
            "scheduled_date": now_dt.date().isoformat(), "scheduled_time": "10:00:00",
            "status": "UPCOMING"
        }
        mock_db.medication_schedules.insert_one(sched)

        # Fresh QR verification (verified 2 minutes ago)
        fresh_time = (now_dt - timedelta(minutes=2)).isoformat()
        qr_doc = {
            "_id": qr_id, "id": qr_id, "verification_type": "MEDICATION",
            "patient_id": p_id, "medication_schedule_id": sched_id,
            "verified_by": int(self.nurse_1.id), "nurse_id": self.nurse_1.id,
            "verified_at": fresh_time, "patient_qr_valid": True,
            "medication_valid": True, "result": "SUCCESS",
            "is_consumed": False,
        }
        mock_db.qr_verifications.insert_one(qr_doc)

        # Assign nurse
        assign = {"_id": 9910, "id": 9910, "patient_id": p_id, "nurse_id": self.nurse_1.id, "is_active": True}
        mock_db.nurse_patient_assignments.insert_one(assign)

        req = MedicationAdministrationCreate(
            medication_schedule_id=sched_id,
            qr_verification_id=qr_id,
            status="GIVEN",
            notes="Dose given on time.",
        )
        res = administer_medication(schedule_id=sched_id, request=req, current_user=self.nurse_1)
        self.assertIn("GIVEN", res["status"])

        # Verify QR verification was consumed
        consumed_qr = mock_db.qr_verifications.find_one({"_id": qr_id})
        self.assertTrue(consumed_qr.get("is_consumed"))

    def test_06_qr_stale_beyond_window_denied(self):
        now_dt = datetime.now(timezone.utc)
        qr_id = 9911
        sched_id = 9911
        item_id = 9911
        rx_id = 9911
        p_id = 9910

        p = {"_id": p_id, "id": p_id, "patient_id": "P9910", "first_name": "QRStale", "last_name": "Patient", "is_active": True}
        mock_db.patients.insert_one(p)

        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "doctor_id": self.doc_a.id, "status": "ACTIVE"}
        mock_db.prescriptions.insert_one(rx)

        item = {"_id": item_id, "id": item_id, "prescription_id": rx_id, "medicine_id": 1, "dose": "500mg", "status": "ACTIVE"}
        mock_db.prescription_items.insert_one(item)

        sched = {
            "_id": sched_id, "id": sched_id, "prescription_item_id": item_id,
            "scheduled_date": now_dt.date().isoformat(), "scheduled_time": "10:00:00",
            "status": "UPCOMING"
        }
        mock_db.medication_schedules.insert_one(sched)

        # Stale verification: 20 minutes ago (hospital policy is 5 min)
        stale_time = (now_dt - timedelta(minutes=20)).isoformat()
        qr_doc = {
            "_id": qr_id, "id": qr_id, "verification_type": "MEDICATION",
            "patient_id": p_id, "medication_schedule_id": sched_id,
            "verified_by": int(self.nurse_1.id), "nurse_id": self.nurse_1.id,
            "verified_at": stale_time, "patient_qr_valid": True,
            "medication_valid": True, "result": "SUCCESS",
            "is_consumed": False,
        }
        mock_db.qr_verifications.insert_one(qr_doc)

        assign = {"_id": 9911, "id": 9911, "patient_id": p_id, "nurse_id": self.nurse_1.id, "is_active": True}
        mock_db.nurse_patient_assignments.insert_one(assign)

        req = MedicationAdministrationCreate(
            medication_schedule_id=sched_id,
            qr_verification_id=qr_id,
            status="GIVEN",
        )
        with self.assertRaises(HTTPException) as ctx:
            administer_medication(schedule_id=sched_id, request=req, current_user=self.nurse_1)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("expired", ctx.exception.detail.lower())

    def test_07_qr_consumed_replay_denied(self):
        qr_id = 9912
        sched_id = 9912
        item_id = 9912
        rx_id = 9912
        p_id = 9910

        now_dt = datetime.now(timezone.utc)
        p = {"_id": p_id, "id": p_id, "patient_id": "P9910", "first_name": "QRReplay", "last_name": "Patient", "is_active": True}
        mock_db.patients.insert_one(p)

        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "doctor_id": self.doc_a.id, "status": "ACTIVE"}
        mock_db.prescriptions.insert_one(rx)

        item = {"_id": item_id, "id": item_id, "prescription_id": rx_id, "medicine_id": 1, "dose": "500mg", "status": "ACTIVE"}
        mock_db.prescription_items.insert_one(item)

        sched = {
            "_id": sched_id, "id": sched_id, "prescription_item_id": item_id,
            "scheduled_date": now_dt.date().isoformat(), "scheduled_time": "10:00:00",
            "status": "UPCOMING"
        }
        mock_db.medication_schedules.insert_one(sched)

        now_iso = now_dt.isoformat()
        consumed_qr = {
            "_id": qr_id, "id": qr_id, "verification_type": "MEDICATION",
            "patient_id": p_id, "medication_schedule_id": sched_id,
            "verified_by": int(self.nurse_1.id), "nurse_id": self.nurse_1.id,
            "verified_at": now_iso, "patient_qr_valid": True,
            "medication_valid": True, "result": "SUCCESS",
            "is_consumed": True,  # Already used!
        }
        mock_db.qr_verifications.insert_one(consumed_qr)

        assign = {"_id": 9912, "id": 9912, "patient_id": p_id, "nurse_id": self.nurse_1.id, "is_active": True}
        mock_db.nurse_patient_assignments.insert_one(assign)

        req = MedicationAdministrationCreate(
            medication_schedule_id=sched_id,
            qr_verification_id=qr_id,
            status="GIVEN",
        )
        with self.assertRaises(HTTPException) as ctx:
            administer_medication(schedule_id=sched_id, request=req, current_user=self.nurse_1)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("already been consumed", ctx.exception.detail.lower())

    # =========================================================================
    # 3. VULNERABILITY 3: PRESCRIPTION BOLA / IDOR (doctor.py)
    # =========================================================================

    def test_08_prescription_bola_cross_doctor_update_denied(self):
        rx_id = 9920
        item_id = 9920
        p_id = 9920

        p = {"_id": p_id, "id": p_id, "patient_id": "P9920", "first_name": "Bola", "last_name": "Test", "is_active": True}
        mock_db.patients.insert_one(p)

        rx = {
            "_id": rx_id, "id": rx_id, "patient_id": p_id,
            "doctor_id": self.doc_a.id, "status": "ACTIVE"
        }
        mock_db.prescriptions.insert_one(rx)

        item = {
            "_id": item_id, "id": item_id, "prescription_id": rx_id,
            "medicine_id": 1, "dose": "100mg", "frequency": "ONCE_DAILY",
            "duration_days": 1, "start_date": "2026-11-15", "start_time": "08:00:00",
            "status": "ACTIVE",
        }
        mock_db.prescription_items.insert_one(item)

        # Doctor B attempts to update Doctor A's prescription -> 403 Forbidden
        update_req = PrescriptionUpdate(notes="Malicious update")
        with self.assertRaises(HTTPException) as ctx:
            update_prescription(prescription_id=rx_id, request=update_req, current_user=self.doc_b)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("not authorized", ctx.exception.detail.lower())

    def test_09_prescription_bola_cross_doctor_stop_denied(self):
        rx_id = 9921
        p_id = 9920
        rx = {
            "_id": rx_id, "id": rx_id, "patient_id": p_id,
            "doctor_id": self.doc_a.id, "status": "ACTIVE"
        }
        mock_db.prescriptions.insert_one(rx)

        # Doctor B attempts to stop Doctor A's prescription -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            stop_prescription(prescription_id=rx_id, current_user=self.doc_b)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("not authorized", ctx.exception.detail.lower())

    def test_10_prescription_author_and_admin_allowed(self):
        rx_id = 9922
        p_id = 9920
        item_id = 9922
        rx = {
            "_id": rx_id, "id": rx_id, "patient_id": p_id,
            "doctor_id": self.doc_a.id, "status": "ACTIVE"
        }
        mock_db.prescriptions.insert_one(rx)

        item = {
            "_id": item_id, "id": item_id, "prescription_id": rx_id,
            "medicine_id": 1, "dose": "50mg", "frequency": "ONCE_DAILY",
            "duration_days": 1, "start_date": "2026-11-15", "start_time": "08:00:00",
            "route": "Oral", "is_stat": False, "instructions": "Take with water",
            "status": "ACTIVE",
        }
        mock_db.prescription_items.insert_one(item)

        # Doctor A updates own prescription -> Allowed
        res = update_prescription(prescription_id=rx_id, request=PrescriptionUpdate(notes="Updated dose"), current_user=self.doc_a)
        self.assertIn("updated", res["message"].lower())

        # Admin stops prescription -> Allowed
        res_stop = stop_prescription(prescription_id=rx_id, current_user=self.admin)
        self.assertIn("stopped", res_stop["message"].lower())

    def test_10b_prescription_bola_cross_doctor_replace_denied(self):
        rx_id = 9923
        p_id = 9920
        rx = {
            "_id": rx_id, "id": rx_id, "patient_id": p_id,
            "doctor_id": self.doc_a.id, "status": "ACTIVE"
        }
        mock_db.prescriptions.insert_one(rx)

        # Doctor B attempts to replace Doctor A's prescription -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            get_doctor_prescription_or_403(rx_id, current_user=self.doc_b, require_active=True)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("not authorized", ctx.exception.detail.lower())

    # =========================================================================
    # 4. VULNERABILITY 4: PHARMACY DISPENSE VALIDATION (pharmacy.py)
    # =========================================================================

    def test_11_pharmacy_dispense_fabricated_rx_denied(self):
        med_id = 9930
        batch_id = 9930
        med = {"_id": med_id, "id": med_id, "name": "PharmacyTestMed", "total_stock": 100, "is_archived": False}
        mock_db.medicines.insert_one(med)

        batch = {"_id": batch_id, "id": batch_id, "medicine_id": med_id, "batch_number": "BATCH9930", "current_quantity": 100, "status": "ACTIVE", "expiry_date": "2027-01-01"}
        mock_db.medicine_batches.insert_one(batch)

        # Non-existent prescription ID 999999 -> 404
        disp_req = DispenseCreate(
            medicine_id=med_id,
            quantity=10,
            prescription_id=999999,
        )
        with self.assertRaises(HTTPException) as ctx:
            dispense_medicine(request=disp_req, current_user=self.pharmacist)
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("prescription #999999 not found", ctx.exception.detail.lower())

    def test_12_pharmacy_dispense_inactive_rx_denied(self):
        med_id = 9930
        batch_id = 9930
        rx_id = 9931
        p_id = 9920

        med = {"_id": med_id, "id": med_id, "name": "PharmacyTestMed", "total_stock": 100, "is_archived": False}
        mock_db.medicines.insert_one(med)

        batch = {"_id": batch_id, "id": batch_id, "medicine_id": med_id, "batch_number": "BATCH9930", "current_quantity": 100, "status": "ACTIVE", "expiry_date": "2027-01-01"}
        mock_db.medicine_batches.insert_one(batch)

        # Inactive prescription (STOPPED) -> 400
        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "status": "STOPPED"}
        mock_db.prescriptions.insert_one(rx)

        disp_req = DispenseCreate(
            medicine_id=med_id,
            quantity=10,
            prescription_id=rx_id,
        )
        with self.assertRaises(HTTPException) as ctx:
            dispense_medicine(request=disp_req, current_user=self.pharmacist)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("only active prescriptions can be dispensed", ctx.exception.detail.lower())

    def test_13_pharmacy_dispense_unprescribed_drug_denied(self):
        med_id = 9930
        unprescribed_med_id = 9932
        rx_id = 9933
        p_id = 9920

        mock_db.medicines.insert_one({"_id": unprescribed_med_id, "id": unprescribed_med_id, "name": "WrongDrug", "total_stock": 50, "is_archived": False})
        mock_db.medicine_batches.insert_one({"_id": 9932, "id": 9932, "medicine_id": unprescribed_med_id, "batch_number": "B9932", "current_quantity": 50, "status": "ACTIVE", "expiry_date": "2027-01-01"})

        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "status": "ACTIVE"}
        mock_db.prescriptions.insert_one(rx)

        # Prescription only contains med_id 9930
        item = {"_id": 9933, "id": 9933, "prescription_id": rx_id, "medicine_id": med_id, "status": "ACTIVE"}
        mock_db.prescription_items.insert_one(item)

        # Attempt to dispense unprescribed_med_id under rx_id -> 400
        disp_req = DispenseCreate(
            medicine_id=unprescribed_med_id,
            quantity=5,
            prescription_id=rx_id,
        )
        with self.assertRaises(HTTPException) as ctx:
            dispense_medicine(request=disp_req, current_user=self.pharmacist)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("not prescribed under prescription", ctx.exception.detail.lower())

    def test_13b_pharmacy_dispense_no_rx_without_justification_denied(self):
        # Dispense without prescription_id and without notes raises ValidationError
        with self.assertRaises(ValidationError):
            DispenseCreate(
                medicine_id=1,
                quantity=10,
                prescription_id=None,
                notes="",
            )

    def test_14_pharmacy_dispense_valid_rx_deducts_inventory(self):
        med_id = 9930
        batch_id = 9930
        rx_id = 9934
        p_id = 9920

        med = {"_id": med_id, "id": med_id, "name": "Aspirin", "total_stock": 100, "is_archived": False}
        mock_db.medicines.insert_one(med)

        batch = {"_id": batch_id, "id": batch_id, "medicine_id": med_id, "batch_number": "BATCH1", "current_quantity": 100, "status": "ACTIVE", "expiry_date": "2027-01-01"}
        mock_db.medicine_batches.insert_one(batch)

        p = {"_id": p_id, "id": p_id, "first_name": "John", "last_name": "Doe"}
        mock_db.patients.insert_one(p)

        rx = {"_id": rx_id, "id": rx_id, "patient_id": p_id, "status": "ACTIVE"}
        mock_db.prescriptions.insert_one(rx)

        item = {"_id": 9934, "id": 9934, "prescription_id": rx_id, "medicine_id": med_id, "status": "ACTIVE"}
        mock_db.prescription_items.insert_one(item)

        prev_stock = mock_db.medicines.find_one({"_id": med_id})["total_stock"]

        disp_req = DispenseCreate(
            medicine_id=med_id,
            quantity=10,
            prescription_id=rx_id,
            patient_id=p_id,
        )
        res = dispense_medicine(request=disp_req, current_user=self.pharmacist)
        self.assertIn("successfully dispensed", res["message"].lower())

        new_stock = mock_db.medicines.find_one({"_id": med_id})["total_stock"]
        self.assertEqual(new_stock, prev_stock - 10)

    # =========================================================================
    # 5. VULNERABILITY 5: MONITORING ALERT AUTHORIZATION (monitoring.py)
    # =========================================================================

    def test_15_monitoring_alerts_non_clinical_denied(self):
        # Receptionist & Pharmacist denied access to clinical medication alerts -> 403
        with self.assertRaises(HTTPException) as ctx1:
            get_alerts(current_user=self.receptionist)
        self.assertEqual(ctx1.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx2:
            get_alerts(current_user=self.pharmacist)
        self.assertEqual(ctx2.exception.status_code, 403)

    def test_16_monitoring_alerts_nurse_scoping_and_acknowledgement(self):
        alert_id_assigned = 9940
        alert_id_unassigned = 9941
        p_assigned = 9940
        p_unassigned = 9941

        # Create alert for assigned patient
        mock_db.medication_alerts.insert_one({
            "_id": alert_id_assigned, "id": alert_id_assigned,
            "patient_id": p_assigned, "medicine_name": "Aspirin",
            "alert_type": "OVERDUE", "is_acknowledged": False,
            "assigned_nurse_ids": [self.nurse_1.id],
        })

        # Create alert for unassigned patient
        mock_db.medication_alerts.insert_one({
            "_id": alert_id_unassigned, "id": alert_id_unassigned,
            "patient_id": p_unassigned, "medicine_name": "Morphine",
            "alert_type": "MISSED", "is_acknowledged": False,
            "assigned_nurse_ids": [self.nurse_2.id],
        })

        # Nurse 1 querying alerts receives only assigned alert
        nurse_alerts = get_alerts(current_user=self.nurse_1)
        alert_ids = [a["id"] for a in nurse_alerts]
        self.assertIn(alert_id_assigned, alert_ids)
        self.assertNotIn(alert_id_unassigned, alert_ids)

        # Nurse 1 attempting to acknowledge unassigned alert -> 403 Forbidden
        ack_req = MedicationAlertAcknowledgeRequest(acknowledgement_note="Tried to dismiss")
        with self.assertRaises(HTTPException) as ctx:
            acknowledge_alert(alert_id=alert_id_unassigned, request=ack_req, current_user=self.nurse_1)
        self.assertEqual(ctx.exception.status_code, 403)

        # Nurse 1 acknowledging assigned alert -> 200 Success
        res = acknowledge_alert(alert_id=alert_id_assigned, request=ack_req, current_user=self.nurse_1)
        self.assertIn("acknowledged successfully", res["message"].lower())

    def test_16b_monitoring_alerts_doctor_scoping_and_acknowledgement(self):
        alert_id_assigned = 9943
        alert_id_unassigned = 9944
        p_assigned = 9943
        p_unassigned = 9944

        # Active encounter for doc_a on p_assigned
        mock_db.encounters.insert_one({"_id": 9943, "id": 9943, "patient_id": p_assigned, "doctor_id": self.doc_a.id, "status": "ACTIVE"})

        mock_db.medication_alerts.insert_one({
            "_id": alert_id_assigned, "id": alert_id_assigned,
            "patient_id": p_assigned, "medicine_name": "Aspirin",
            "alert_type": "OVERDUE", "is_acknowledged": False,
        })
        mock_db.medication_alerts.insert_one({
            "_id": alert_id_unassigned, "id": alert_id_unassigned,
            "patient_id": p_unassigned, "medicine_name": "Morphine",
            "alert_type": "MISSED", "is_acknowledged": False,
        })

        # Doc B attempting to acknowledge Doc A's patient alert -> 403 Forbidden
        ack_req = MedicationAlertAcknowledgeRequest(acknowledgement_note="Doc B tried to dismiss")
        with self.assertRaises(HTTPException) as ctx:
            acknowledge_alert(alert_id=alert_id_assigned, request=ack_req, current_user=self.doc_b)
        self.assertEqual(ctx.exception.status_code, 403)

        # Doc A acknowledging assigned patient alert -> 200 Success
        res = acknowledge_alert(alert_id=alert_id_assigned, request=ack_req, current_user=self.doc_a)
        self.assertIn("acknowledged successfully", res["message"].lower())

    def test_17_monitoring_alerts_admin_acknowledgement(self):
        alert_id = 9942
        mock_db.medication_alerts.insert_one({
            "_id": alert_id, "id": alert_id,
            "patient_id": 9942, "medicine_name": "Paracetamol",
            "alert_type": "OVERDUE", "is_acknowledged": False,
            "assigned_nurse_ids": [],
        })

        # Admin acknowledges supervisory alert -> Allowed
        ack_req = MedicationAlertAcknowledgeRequest(acknowledgement_note="Supervisor acknowledged")
        res = acknowledge_alert(alert_id=alert_id, request=ack_req, current_user=self.admin)
        self.assertIn("acknowledged successfully", res["message"].lower())

    # =========================================================================
    # 6. VULNERABILITY 6: PATIENT REGISTRATION PRIVILEGES (hospital.py)
    # =========================================================================

    def test_18_hospital_registration_doctor_nurse_denied(self):
        # Doctor has VIEW_PATIENT & CREATE_PRESCRIPTION but NOT REGISTER_PATIENT -> 403
        with self.assertRaises(HTTPException) as ctx_doc:
            require_patient_registration_permission(self.doc_a)
        self.assertEqual(ctx_doc.exception.status_code, 403)
        self.assertIn("permission required", ctx_doc.exception.detail.lower())

        # Nurse has VIEW_PATIENT & ADMINISTER_MEDICATION but NOT REGISTER_PATIENT -> 403
        with self.assertRaises(HTTPException) as ctx_nurse:
            require_patient_registration_permission(self.nurse_1)
        self.assertEqual(ctx_nurse.exception.status_code, 403)
        self.assertIn("permission required", ctx_nurse.exception.detail.lower())

    def test_19_hospital_registration_receptionist_and_admin_allowed(self):
        # Receptionist has REGISTER_PATIENT -> Allowed
        rec_user = require_patient_registration_permission(self.receptionist)
        self.assertEqual(rec_user.id, self.receptionist.id)

        # Admin has MANAGE_SYSTEM -> Allowed
        adm_user = require_patient_registration_permission(self.admin)
        self.assertEqual(adm_user.id, self.admin.id)


if __name__ == "__main__":
    unittest.main()
