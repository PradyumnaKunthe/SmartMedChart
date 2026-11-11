"""
SmartMedChart – Complete 13 API Security Vulnerabilities Verification Test Suite
Fully isolated in-memory verification for:
1. Finding 1 (P0): Hospital-Wide Unscoped Medication PHI Exposure (dashboard.py)
2. Finding 2 (P1): Unauthenticated MongoDB Status Endpoint (mongodb_status.py)
3. Finding 3 (P1): Wristband QR Token Exposure in Doctor Rounds API (doctor.py & nurse.py)
4. Finding 4 (P1): Allergy CRUD Operations Using VIEW_PATIENT Permission (allergies.py)
5. Finding 5 (P1): Cross-Staff Medication Hold Override (nurse.py)
6. Finding 6 (P1): Unbounded Nurse Medication Query and N+1 DoS (nurse.py)
7. Finding 7 (P2): Predictable Readmission QR Token (admin.py)
8. Finding 8 (P2): Synchronous DDL Index Creation in CareMatch Request (carematch.py & mongo_client.py)
9. Finding 9 (P2): Hospital Policy Dictionary Mass Assignment (monitoring.py & medication_monitoring_service.py)
10. Finding 10 (P2): Unbounded AI Predictions Collection Query (ai.py)
11. Finding 11 (P2): Distributed Rate Limiter & Server-Side Token Revocation (rate_limiter.py, security.py, auth.py)
12. Finding 12 (P3): Public API Documentation and Debug Test Endpoints (main.py, auth.py, doctor.py)
13. Finding 13 (P4): Hardcoded Private LAN Address in CORS (main.py)
"""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from pydantic import ValidationError


class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []
        self.indexes = []

    def create_index(self, keys, **kwargs):
        self.indexes.append({"keys": keys, "kwargs": kwargs})
        return "mock_index"

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
            def skip(self, n):
                self.docs = self.docs[n:]
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

    def count_documents(self, query=None):
        if not query:
            return len(self.docs)
        return len([d for d in self.docs if self._matches(d, query)])

    def distinct(self, key, query=None):
        res = set()
        for d in self.docs:
            if query is None or self._matches(d, query):
                val = d.get(key)
                if val is not None:
                    if isinstance(val, list):
                        res.update(val)
                    else:
                        res.add(val)
        return list(res)

    def update_one(self, query, update, upsert=False):
        matched = False
        for d in self.docs:
            if self._matches(d, query):
                matched = True
                if "$set" in update:
                    d.update(update["$set"])
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in d or not isinstance(d[k], list):
                            d[k] = []
                        d[k].append(v)
                if "$pull" in update:
                    for k, v in update["$pull"].items():
                        if k in d and isinstance(d[k], list):
                            if isinstance(v, dict) and "$lte" in v:
                                cutoff = v["$lte"]
                                d[k] = [x for x in d[k] if x > cutoff]
                break
        if not matched and upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            self.insert_one(new_doc)
        return SimpleNamespace(matched_count=1 if matched else 0)

    def update_many(self, query, update):
        count = 0
        for d in self.docs:
            if self._matches(d, query):
                count += 1
                if "$set" in update:
                    d.update(update["$set"])
        return SimpleNamespace(matched_count=count, modified_count=count)

    def find_one_and_update(self, query, update, return_document=True, upsert=False):
        for d in self.docs:
            if self._matches(d, query):
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        d[k] = d.get(k, 0) + v
                if "$set" in update:
                    d.update(update["$set"])
                return dict(d)
        if upsert:
            new_doc = dict(query)
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    new_doc[k] = v
            if "$set" in update:
                new_doc.update(update["$set"])
            self.insert_one(new_doc)
            return dict(new_doc)
        return None

    def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                self.docs.pop(i)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def delete_many(self, query):
        orig_len = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        return SimpleNamespace(deleted_count=orig_len - len(self.docs))

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, cond) for cond in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, cond) for cond in v):
                    return False
            elif isinstance(v, dict):
                if "$in" in v:
                    doc_val = doc.get(k)
                    in_list = v["$in"]
                    if isinstance(doc_val, list):
                        if not any(x in in_list for x in doc_val):
                            return False
                    elif doc_val not in in_list:
                        return False
                if "$nin" in v:
                    if doc.get(k) in v["$nin"]:
                        return False
                if "$ne" in v:
                    if doc.get(k) == v["$ne"]:
                        return False
            else:
                if doc.get(k) != v:
                    return False
        return True


class MockDatabase:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getattr__(self, name):
        return self[name]


def make_test_user(user_id=1, username="testuser", role_name="Doctor", permissions=None):
    if permissions is None:
        permissions = ["VIEW_PATIENT"]
    role = SimpleNamespace(id=1, name=role_name, permissions=[SimpleNamespace(name=p) for p in permissions])
    return SimpleNamespace(
        id=user_id,
        username=username,
        full_name=f"{role_name} {username}",
        role=role,
        permissions=permissions,
        is_active=True,
    )


class TestCompleteApiSecurityRemediation(unittest.TestCase):
    def setUp(self):
        self.mock_db = MockDatabase()
        import app.mongo_client
        app.mongo_client.mongo_db = self.mock_db

        # Patch mongo_db in imported routes
        import app.routes.dashboard
        import app.routes.mongodb_status
        import app.routes.doctor
        import app.routes.nurse
        import app.routes.allergies
        import app.routes.admin
        import app.routes.carematch
        import app.routes.monitoring
        import app.routes.ai
        import app.routes.auth
        import app.security
        import app.services.rate_limiter
        import app.services.medication_monitoring_service
        import app.services.qr_service

        for mod in (
            app.routes.dashboard,
            app.routes.mongodb_status,
            app.routes.doctor,
            app.routes.nurse,
            app.routes.allergies,
            app.routes.admin,
            app.routes.carematch,
            app.routes.monitoring,
            app.routes.ai,
            app.routes.auth,
            app.security,
            app.services.rate_limiter,
            app.services.medication_monitoring_service,
            app.services.qr_service,
        ):
            mod.mongo_db = self.mock_db

    # =========================================================================
    # FINDING 1 (P0): Hospital-Wide Unscoped Medication PHI Exposure
    # =========================================================================
    def test_finding_1_dashboard_patient_scoping(self):
        from app.routes.dashboard import get_dashboard_authorized_patient_scope, get_medication_summary

        # Seed data: Patient 101 assigned to Doctor 1, Patient 102 to Doctor 2
        self.mock_db.encounters.insert_one({"patient_id": 101, "doctor_id": 1, "status": "ACTIVE"})
        self.mock_db.encounters.insert_one({"patient_id": 102, "doctor_id": 2, "status": "ACTIVE"})

        doc1_user = make_test_user(user_id=1, role_name="Doctor", permissions=["VIEW_MEDICATION_SCHEDULE"])
        scope_doc1 = get_dashboard_authorized_patient_scope(doc1_user)
        self.assertEqual(scope_doc1, [101])

        # Non-clinical staff (Pharmacist or Receptionist) without patient roster gets 403 Forbidden
        receptionist_user = make_test_user(user_id=5, role_name="Receptionist", permissions=["VIEW_PATIENT"])
        with self.assertRaises(HTTPException) as ctx:
            get_dashboard_authorized_patient_scope(receptionist_user)
        self.assertEqual(ctx.exception.status_code, 403)

        # Admin gets unrestricted scope (None)
        admin_user = make_test_user(user_id=99, role_name="Administrator", permissions=["MANAGE_SYSTEM"])
        self.assertIsNone(get_dashboard_authorized_patient_scope(admin_user))

    # =========================================================================
    # FINDING 2 (P1): Unauthenticated MongoDB Status Endpoint
    # =========================================================================
    def test_finding_2_mongodb_status_authentication(self):
        import app.routes.mongodb_status as ms_mod

        # Mock ping_mongodb so no network call is attempted
        orig_ping = getattr(ms_mod, "ping_mongodb", None)
        ms_mod.ping_mongodb = lambda: True

        try:
            # Endpoint dependency requires MANAGE_SYSTEM
            admin_user = make_test_user(user_id=99, role_name="Administrator", permissions=["MANAGE_SYSTEM"])
            res = ms_mod.mongodb_status(current_user=admin_user)
            self.assertIn("status", res)
            self.assertEqual(res["status"], "connected")
        finally:
            if orig_ping:
                ms_mod.ping_mongodb = orig_ping

    # =========================================================================
    # FINDING 3 (P1): Wristband QR Token Exposure in Doctor/Nurse Listings
    # =========================================================================
    def test_finding_3_qr_token_stripped_from_patient_listings(self):
        from app.routes.doctor import get_doctor_round_patients
        from app.routes.nurse import get_nurse_assigned_patients

        # Seed patient with sensitive qr_token
        self.mock_db.patients.insert_one({
            "_id": 101,
            "id": 101,
            "patient_id": "PAT-101",
            "first_name": "Alice",
            "last_name": "Smith",
            "is_active": True,
            "lifecycle_status": "ACTIVE",
            "qr_token": "SUPER_SECRET_BEARER_TOKEN_12345",
            "qr_is_active": True,
        })
        self.mock_db.encounters.insert_one({"patient_id": 101, "doctor_id": 1, "status": "ACTIVE"})
        self.mock_db.nurse_patient_assignments.insert_one({"nurse_id": 2, "patient_id": 101, "is_active": True})

        doc_user = make_test_user(user_id=1, role_name="Doctor", permissions=["VIEW_PATIENT"])
        round_patients = get_doctor_round_patients(current_user=doc_user)
        self.assertTrue(len(round_patients) > 0)
        self.assertNotIn("qr_token", round_patients[0])
        self.assertTrue(round_patients[0]["qr_is_active"])

        nurse_user = make_test_user(user_id=2, role_name="Nurse", permissions=["VIEW_PATIENT"])
        assigned_patients = get_nurse_assigned_patients(current_user=nurse_user)
        self.assertTrue(len(assigned_patients) > 0)
        self.assertNotIn("qr_token", assigned_patients[0])
        self.assertTrue(assigned_patients[0]["qr_is_active"])

    # =========================================================================
    # FINDING 4 (P1): Allergy CRUD Operations Using VIEW_PATIENT Permission
    # =========================================================================
    def test_finding_4_allergy_crud_clinical_permission_and_soft_delete(self):
        from app.routes.allergies import create_patient_allergy, delete_patient_allergy
        from app.schemas.allergy import AllergyCreate

        # Seed patient
        self.mock_db.patients.insert_one({"_id": 101, "id": 101, "is_active": True})

        # Non-clinical staff (Receptionist with VIEW_PATIENT) fails clinical check
        receptionist = make_test_user(user_id=3, role_name="Receptionist", permissions=["VIEW_PATIENT"])
        create_req = AllergyCreate(allergen="Penicillin", severity="HIGH", reaction="Anaphylaxis")
        with self.assertRaises(HTTPException) as ctx:
            create_patient_allergy(patient_id=101, request=create_req, current_user=receptionist)
        self.assertEqual(ctx.exception.status_code, 403)

        # Doctor with CREATE_PRESCRIPTION can create allergy
        doctor = make_test_user(user_id=1, role_name="Doctor", permissions=["CREATE_PRESCRIPTION"])
        res = create_patient_allergy(patient_id=101, request=create_req, current_user=doctor)
        self.assertIn("id", res)
        patient_allergy_id = res["id"]

        # Deleting the allergy should soft-archive it, not delete from MongoDB
        del_res = delete_patient_allergy(patient_id=101, allergy_id=patient_allergy_id, current_user=doctor)
        self.assertIn("archived", del_res["message"].lower())
        archived_record = self.mock_db.patient_allergies.find_one({"id": patient_allergy_id})
        self.assertIsNotNone(archived_record)
        self.assertFalse(archived_record["is_active"])
        self.assertEqual(archived_record["archival_status"], "ARCHIVED")
        self.assertEqual(ctx.exception.status_code, 403)

        # Doctor with CREATE_PRESCRIPTION can create allergy
        doctor = make_test_user(user_id=1, role_name="Doctor", permissions=["CREATE_PRESCRIPTION"])
        res = create_patient_allergy(patient_id=101, request=create_req, current_user=doctor)
        self.assertIn("id", res)
        patient_allergy_id = res["id"]

        # Deleting the allergy should soft-archive it, not delete from MongoDB
        del_res = delete_patient_allergy(patient_id=101, allergy_id=patient_allergy_id, current_user=doctor)
        self.assertIn("archived", del_res["message"].lower())
        archived_record = self.mock_db.patient_allergies.find_one({"id": patient_allergy_id})
        self.assertIsNotNone(archived_record)
        self.assertFalse(archived_record["is_active"])
        self.assertEqual(archived_record["archival_status"], "ARCHIVED")

    # =========================================================================
    # FINDING 5 (P1): Cross-Staff Medication Hold Override
    # =========================================================================
    def test_finding_5_hold_medication_override_controls(self):
        from app.routes.nurse import hold_medication, MedicationHoldRequest

        self.mock_db.patients.insert_one({"_id": 101, "id": 101, "is_active": True})
        self.mock_db.nurse_patient_assignments.insert_one({"nurse_id": 10, "patient_id": 101, "is_active": True})
        self.mock_db.medication_schedules.insert_one({"_id": 701, "id": 701, "patient_id": 101, "status": "SCHEDULED"})

        unassigned_nurse = make_test_user(user_id=20, role_name="Nurse", permissions=["ADMINISTER_MEDICATION"])
        req_without_override = MedicationHoldRequest(reason="Patient nauseous")

        # Unassigned nurse without recent QR scan is rejected 403
        with self.assertRaises(HTTPException) as ctx:
            hold_medication(schedule_id=701, request=req_without_override, current_user=unassigned_nurse)
        self.assertEqual(ctx.exception.status_code, 403)

        # Now simulate a bedside scan 2 minutes ago
        self.mock_db.qr_verifications.insert_one({
            "patient_id": 101,
            "verified_by": 20,
            "patient_qr_valid": True,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        })

        # Calling hold without override_reason must be rejected with 400
        with self.assertRaises(HTTPException) as ctx:
            hold_medication(schedule_id=701, request=req_without_override, current_user=unassigned_nurse)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("override_reason", str(ctx.exception.detail))

        # Supplying override_reason succeeds
        req_with_override = MedicationHoldRequest(reason="Patient nauseous", override_reason="Covering for Nurse #10 on break")
        hold_res = hold_medication(schedule_id=701, request=req_with_override, current_user=unassigned_nurse)
        self.assertEqual(hold_res["status"], "HELD")
        self.assertTrue(hold_res["is_override"])
        self.assertEqual(hold_res["override_reason"], "Covering for Nurse #10 on break")

    # =========================================================================
    # FINDING 6 (P1): Unbounded Nurse Medication Query and N+1 DoS
    # =========================================================================
    def test_finding_6_nurse_medication_bounded_and_scoped(self):
        from app.routes.nurse import get_nurse_medications

        # Seed 3 patients: Nurse 1 is assigned to 101 only
        self.mock_db.patients.insert_one({"_id": 101, "id": 101, "first_name": "P1", "is_active": True})
        self.mock_db.patients.insert_one({"_id": 102, "id": 102, "first_name": "P2", "is_active": True})
        self.mock_db.nurse_patient_assignments.insert_one({"nurse_id": 1, "patient_id": 101, "is_active": True})

        self.mock_db.medication_schedules.insert_one({"_id": 1, "id": 1, "patient_id": 101, "scheduled_date": "2026-11-11", "scheduled_time": "10:00"})
        self.mock_db.medication_schedules.insert_one({"_id": 2, "id": 2, "patient_id": 102, "scheduled_date": "2026-11-11", "scheduled_time": "11:00"})

        nurse_user = make_test_user(user_id=1, role_name="Nurse", permissions=["VIEW_MEDICATION_SCHEDULE"])
        # Query without patient_id must ONLY return schedules for patient 101
        res = get_nurse_medications(current_user=nurse_user)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["patient_id"], 101)

    # =========================================================================
    # FINDING 7 (P2): Predictable Readmission QR Token
    # =========================================================================
    def test_finding_7_cryptographically_random_qr_token_on_readmission(self):
        from app.services.qr_service import generate_patient_qr_token

        self.mock_db.patients.insert_one({"_id": 101, "id": 101, "is_active": False})
        token = generate_patient_qr_token(101)
        # Token must NOT match the old predictable pattern QR-PAT-{id}-{ts}
        self.assertFalse(token.startswith("QR-PAT-101-"))
        # Must be urlsafe 32-byte secret (at least 40 chars)
        self.assertTrue(len(token) >= 40)
        pt = self.mock_db.patients.find_one({"_id": 101})
        self.assertEqual(pt["qr_token"], token)

    # =========================================================================
    # FINDING 8 (P2): Synchronous DDL Index Creation in CareMatch
    # =========================================================================
    def test_finding_8_carematch_indexes_startup(self):
        from app.routes.carematch import init_carematch_indexes

        init_carematch_indexes()
        # Verify index was recorded in collection indexes list
        self.assertTrue(len(self.mock_db.carematch_appointments.indexes) > 0)
        self.assertEqual(self.mock_db.carematch_appointments.indexes[0]["kwargs"]["name"], "unique_doctor_appointment_slot")

    # =========================================================================
    # FINDING 9 (P2): Hospital Policy Dictionary Mass Assignment
    # =========================================================================
    def test_finding_9_hospital_policy_validation_and_rejection(self):
        from app.schemas.administration import HospitalPolicyUpdateRequest
        from app.services.medication_monitoring_service import set_hospital_policy

        # Valid payload updates policy
        valid_update = HospitalPolicyUpdateRequest(
            policy_name="ICU Policy",
            on_time_grace_before_minutes=45,
            on_time_grace_after_minutes=60,
        )
        saved = set_hospital_policy(valid_update)
        self.assertEqual(saved["policy_name"], "ICU Policy")
        self.assertEqual(saved["on_time_grace_before_minutes"], 45)

        # Unrecognized / malicious fields are forbidden by Pydantic model
        with self.assertRaises(ValidationError):
            HospitalPolicyUpdateRequest(
                policy_name="Malicious Policy",
                injected_field="malicious_payload",
            )

    # =========================================================================
    # FINDING 10 (P2): Unbounded AI Predictions Collection Query
    # =========================================================================
    def test_finding_10_ai_predictions_bounded_and_scoped(self):
        from app.routes.ai import get_ai_predictions

        # Doctor 1 is assigned to patient 101 only
        self.mock_db.encounters.insert_one({"patient_id": 101, "doctor_id": 1, "status": "ACTIVE"})
        self.mock_db.ai_predictions.insert_one({
            "_id": 1,
            "id": 1,
            "patient_id": 101,
            "medication_schedule_id": 1,
            "delay_probability": 0.8,
            "delay_risk_level": "HIGH",
            "created_at": "2026-11-11 10:00:00",
        })
        self.mock_db.ai_predictions.insert_one({
            "_id": 2,
            "id": 2,
            "patient_id": 102,
            "medication_schedule_id": 2,
            "delay_probability": 0.9,
            "delay_risk_level": "HIGH",
            "created_at": "2026-11-11 11:00:00",
        })

        doctor_user = make_test_user(user_id=1, role_name="Doctor", permissions=["VIEW_MEDICATION_SCHEDULE"])
        res = get_ai_predictions(page=1, limit=10, current_user=doctor_user)
        self.assertIn("predictions", res)
        self.assertEqual(len(res["predictions"]), 1)
        self.assertEqual(res["predictions"][0]["id"], 1)

    # =========================================================================
    # FINDING 11 (P2): Distributed Rate Limiter & Server-Side Token Revocation
    # =========================================================================
    def test_finding_11_token_revocation_and_rate_limiter(self):
        from app.security import create_access_token, decode_access_token, revoke_token, get_current_user
        from app.services.rate_limiter import login_rate_limiter

        # 1. Token revocation
        token = create_access_token("1", expires_minutes=15)
        payload = decode_access_token(token)
        self.assertIn("jti", payload)

        # Before revocation, user is valid
        self.mock_db.roles.insert_one({"_id": 1, "id": 1, "name": "Doctor", "permissions": []})
        self.mock_db.users.insert_one({"_id": 1, "id": 1, "username": "testuser", "role_id": 1, "is_active": True})
        creds = SimpleNamespace(credentials=token)
        user = get_current_user(creds)
        self.assertEqual(user.id, 1)

        # Revoke the token
        revoked_ok = revoke_token(token)
        self.assertTrue(revoked_ok)

        # After revocation, get_current_user must raise 401
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(creds)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("revoked", str(ctx.exception.detail).lower())

        # 2. Rate limiter MongoDB persistence
        key = "127.0.0.1:baduser"
        login_rate_limiter.reset()
        for _ in range(5):
            login_rate_limiter.record_failure(key)
        self.assertTrue(login_rate_limiter.is_rate_limited(key))
        # Ensure it was persisted to MongoDB
        db_doc = self.mock_db.login_rate_limits.find_one({"_id": key})
        self.assertIsNotNone(db_doc)
        self.assertEqual(len(db_doc["attempts"]), 5)

    # =========================================================================
    # FINDING 12 (P3): Public API Documentation and Debug Test Endpoints
    # =========================================================================
    def test_finding_12_debug_endpoints_gate(self):
        from app.routes.auth import nurse_test, medication_admin_test
        from app.routes.doctor import doctor_test

        admin_user = make_test_user(user_id=99, role_name="Administrator", permissions=["MANAGE_SYSTEM"])
        self.assertIn("system management privileges", nurse_test(current_user=admin_user)["message"])
        self.assertIn("system management privileges", medication_admin_test(current_user=admin_user)["message"])
        self.assertIn("system management privileges", doctor_test(current_user=admin_user)["message"])

    # =========================================================================
    # FINDING 13 (P4): Hardcoded Private LAN Address in CORS
    # =========================================================================
    def test_finding_13_no_hardcoded_lan_in_cors(self):
        from main import get_cors_origins

        origins = get_cors_origins()
        self.assertNotIn("http://172.20.10.2:5173", origins)


if __name__ == "__main__":
    unittest.main()
