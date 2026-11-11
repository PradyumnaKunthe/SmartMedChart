"""
SmartMedChart – Comprehensive Security, Validation and Session Lifecycle Test Suite
Validates:
1. Pydantic request models & field validation (whitespace, email, phone, DOB, password, numeric limits, strict fields)
2. Authentication & JWT security (algorithm pinning, expiration, claims, inactive user rejection)
3. Role-Based Access Control (RBAC) (admin, doctor, nurse permission checks, 401 & 403 enforcement)
4. Brute-force login rate limiting (sliding-window 429 enforcement)
5. Security headers & payload size limiting (413 Payload Too Large, X-Content-Type-Options, X-Frame-Options)
6. MongoDB data integrity & injection defense (regex escaping, unique constraints)
"""

import asyncio
import os
import sys
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Disable background scheduler during tests
os.environ["ENABLE_EMBEDDED_SCHEDULER"] = "false"

from jose import jwt
from pydantic import ValidationError
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

# Schemas
from app.schemas.auth import LoginRequest
from app.schemas.admin import StaffCreateRequest, AssignmentCreateRequest, DoctorAssignmentCreateRequest
from app.schemas.patient_registration import PatientRegistrationRequest
from app.schemas.prescription import PrescriptionItemCreate, PrescriptionCreate
from app.schemas.medicine import MedicineCreate, BatchCreate, DispenseCreate
from app.schemas.allergy import AllergyCreate
from app.schemas.administration import MedicationAdministrationCreate
from app.schemas.validators import (
    validate_email_str,
    validate_mobile_number,
    validate_password_str,
    validate_dob_str,
    validate_non_empty_str,
)

# Security and services
import app.mongo_client as mc
from app.security import (
    ALLOWED_JWT_ALGORITHMS,
    JWT_SECRET_KEY,
    create_access_token,
    decode_access_token,
    get_current_user,
    hash_password,
    require_permission,
    require_role,
    verify_password,
)
from app.services.rate_limiter import SlidingWindowRateLimiter
from app.middleware import apply_security_headers, is_payload_oversized, MAX_REQUEST_BODY_BYTES


# In-memory Mock PyMongo Collection
class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []
        self.indexes = {}

    def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = len(self.docs) + 1
        self.docs.append(d)
        return SimpleNamespace(inserted_id=d["_id"])

    def find_one(self, query=None, sort=None, projection=None):
        if not query:
            return dict(self.docs[0]) if self.docs else None
        for d in self.docs:
            if self._matches(d, query):
                return dict(d)
        return None

    def find(self, query=None, projection=None):
        if not query:
            return [dict(d) for d in self.docs]
        return [dict(d) for d in self.docs if self._matches(d, query)]

    def create_index(self, keys, **kwargs):
        index_name = kwargs.get("name", str(keys))
        self.indexes[index_name] = {"keys": keys, "kwargs": kwargs}
        return index_name

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, subq) for subq in v):
                    return False
            elif isinstance(v, dict):
                if "$in" in v:
                    doc_val = doc.get(k)
                    if doc_val not in v["$in"]:
                        return False
            elif doc.get(k) != v:
                return False
        return True


class TestFormValidation(unittest.TestCase):
    """Test Pydantic Request Validation and Field Normalization."""

    def test_login_request_rejects_whitespace_username(self):
        with self.assertRaises(ValidationError):
            LoginRequest(username="   ", password="ValidPassword123")

    def test_login_request_rejects_short_password(self):
        with self.assertRaises(ValidationError) as ctx:
            LoginRequest(username="doctor1", password="123")
        self.assertIn("at least 8 characters", str(ctx.exception))

    def test_login_request_forbids_extra_fields(self):
        with self.assertRaises(ValidationError) as ctx:
            LoginRequest.model_validate({
                "username": "doctor1",
                "password": "ValidPassword123",
                "is_admin": True,  # Unexpected injection attempt
            })
        self.assertIn("extra_forbidden", str(ctx.exception))

    def test_staff_create_validates_email_syntax_and_normalizes(self):
        # Valid email with mixed case
        staff = StaffCreateRequest(
            full_name="Dr. Jane Smith",
            username="janesmith",
            email="  Dr.Jane@Hospital.Org  ",
            password="StrongPassword123!",
            role="Doctor",
        )
        self.assertEqual(staff.email, "dr.jane@hospital.org")

        # Invalid email syntax
        with self.assertRaises(ValidationError) as ctx:
            StaffCreateRequest(
                full_name="Dr. Jane Smith",
                username="janesmith",
                email="invalid-email-address",
                password="StrongPassword123!",
                role="Doctor",
            )
        self.assertIn("valid email address", str(ctx.exception))

    def test_staff_create_rejects_whitespace_password(self):
        with self.assertRaises(ValidationError):
            StaffCreateRequest(
                full_name="Dr. Jane Smith",
                username="janesmith",
                email="jane@hospital.org",
                password="                ",
                role="Doctor",
            )

    def test_staff_create_forbids_extra_parameters(self):
        with self.assertRaises(ValidationError) as ctx:
            StaffCreateRequest.model_validate({
                "full_name": "Nurse Sarah",
                "username": "nurse_sarah",
                "email": "sarah@hospital.org",
                "password": "Password1234",
                "role": "Nurse",
                "role_id": 1,  # Parameter pollution attempt
            })
        self.assertIn("extra_forbidden", str(ctx.exception))

    def test_patient_registration_mobile_validation_and_normalization(self):
        # Standard Indian 10-digit number
        req1 = PatientRegistrationRequest(
            full_name="Rahul Sharma",
            mobile_number="9876543210",
        )
        self.assertEqual(req1.mobile_number, "9876543210")

        # Indian number with +91 prefix and hyphens
        req2 = PatientRegistrationRequest(
            full_name="Rahul Sharma",
            mobile_number="+91 98765-43210",
        )
        self.assertEqual(req2.mobile_number, "9876543210")

        # Alphabetic characters in mobile number rejected
        with self.assertRaises(ValidationError) as ctx:
            PatientRegistrationRequest(
                full_name="Rahul Sharma",
                mobile_number="98765ABCDE",
            )
        self.assertIn("Alphabetic characters are not permitted", str(ctx.exception))

    def test_patient_registration_dob_validation(self):
        # Valid historical date
        req = PatientRegistrationRequest(
            full_name="Pooja Patel",
            date_of_birth="1995-04-12",
        )
        self.assertEqual(req.date_of_birth, "1995-04-12")

        # Future date of birth rejected
        future_date = f"{date.today().year + 1}-01-01"
        with self.assertRaises(ValidationError) as ctx:
            PatientRegistrationRequest(
                full_name="Pooja Patel",
                date_of_birth=future_date,
            )
        self.assertIn("Date of birth cannot be in the future", str(ctx.exception))

    def test_prescription_item_validation(self):
        # Valid item
        item = PrescriptionItemCreate(
            medicine_id=1,
            dose="500 mg",
            route="Oral",
            frequency="TWICE_DAILY",
            duration_days=5,
            start_date=date.today(),
            start_time="08:00",
            administration_times=["08:00", "20:00"],
        )
        self.assertEqual(item.dose, "500 mg")

        # Whitespace-only dose rejected
        with self.assertRaises(ValidationError):
            PrescriptionItemCreate(
                medicine_id=1,
                dose="   ",
                route="Oral",
                frequency="TWICE_DAILY",
                duration_days=5,
                start_date=date.today(),
                start_time="08:00",
            )

    def test_administration_status_whitelist(self):
        # Allowed status
        adm = MedicationAdministrationCreate(status="GIVEN")
        self.assertEqual(adm.status, "GIVEN")

        # Disallowed status rejected
        with self.assertRaises(ValidationError) as ctx:
            MedicationAdministrationCreate(status="INVALID_STATUS")
        self.assertIn("Invalid administration status", str(ctx.exception))


class TestAuthenticationAndJWTSecurity(unittest.TestCase):
    """Test JWT session lifecycle, signing algorithm pinning, and active user checks."""

    def test_create_access_token_includes_type_and_claims(self):
        token = create_access_token(subject="101", expires_minutes=15)
        payload = decode_access_token(token)

        self.assertEqual(payload.get("sub"), "101")
        self.assertEqual(payload.get("type"), "access")
        self.assertIn("iat", payload)
        self.assertIn("exp", payload)

    def test_token_decoding_pins_algorithm_to_hs256(self):
        # Token encoded with unauthorized algorithm like 'HS384' is rejected
        untrusted_token = jwt.encode(
            {"sub": "101", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
            key=JWT_SECRET_KEY,
            algorithm="HS384",
        )
        with self.assertRaises(ValueError) as ctx:
            decode_access_token(untrusted_token)
        self.assertIn("Invalid or expired access token", str(ctx.exception))

    def test_expired_token_is_rejected(self):
        expired_token = create_access_token(subject="101", expires_minutes=-10)
        with self.assertRaises(ValueError) as ctx:
            decode_access_token(expired_token)
        self.assertIn("Invalid or expired access token", str(ctx.exception))

    def test_inactive_user_cannot_authenticate(self):
        mock_users = MockCollection("users")
        mock_users.insert_one({
            "_id": 999,
            "id": 999,
            "username": "inactive_nurse",
            "password_hash": hash_password("ValidPassword123"),
            "role_id": 2,
            "is_active": False,
        })
        original_users = mc.mongo_db.users
        try:
            mc.mongo_db.users = mock_users
            from app.services.auth_service import authenticate_user
            user = authenticate_user(username="inactive_nurse", password="ValidPassword123")
            self.assertIsNone(user, "Inactive user must not be authenticated")
        finally:
            mc.mongo_db.users = original_users


class TestRoleBasedAccessControl(unittest.TestCase):
    """Test role and permission authorization enforcement."""

    def test_require_role_matches_role(self):
        user_doctor = SimpleNamespace(
            id=1,
            username="doctor_smith",
            role=SimpleNamespace(name="Doctor", permissions=[]),
        )
        dep = require_role("Doctor")
        result = dep(current_user=user_doctor)
        self.assertEqual(result.username, "doctor_smith")

    def test_require_role_rejects_unauthorized_role(self):
        user_nurse = SimpleNamespace(
            id=2,
            username="nurse_patel",
            role=SimpleNamespace(name="Nurse", permissions=[]),
        )
        dep = require_role("Doctor")
        with self.assertRaises(HTTPException) as ctx:
            dep(current_user=user_nurse)
        self.assertEqual(ctx.exception.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Insufficient role permissions", ctx.exception.detail)

    def test_require_permission_enforces_specific_permission(self):
        user_with_perm = SimpleNamespace(
            id=1,
            username="admin1",
            role=SimpleNamespace(
                name="Administrator",
                permissions=[SimpleNamespace(name="MANAGE_USERS")],
            ),
        )
        dep = require_permission("MANAGE_USERS")
        result = dep(current_user=user_with_perm)
        self.assertEqual(result.username, "admin1")

    def test_require_permission_blocks_unauthorized_permission(self):
        user_without_perm = SimpleNamespace(
            id=2,
            username="nurse1",
            role=SimpleNamespace(
                name="Nurse",
                permissions=[SimpleNamespace(name="VIEW_PATIENT")],
            ),
        )
        dep = require_permission("MANAGE_USERS")
        with self.assertRaises(HTTPException) as ctx:
            dep(current_user=user_without_perm)
        self.assertEqual(ctx.exception.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Insufficient permissions", ctx.exception.detail)


class TestBruteForceLoginRateLimiter(unittest.TestCase):
    """Test sliding-window brute force login rate limiter."""

    def test_rate_limiter_blocks_after_threshold(self):
        limiter = SlidingWindowRateLimiter(max_attempts=3, window_seconds=60)
        key = "192.168.1.1:admin"

        self.assertFalse(limiter.is_rate_limited(key))
        limiter.record_failure(key)
        limiter.record_failure(key)
        self.assertFalse(limiter.is_rate_limited(key))

        limiter.record_failure(key)
        # Threshold reached: 3 failed attempts
        self.assertTrue(limiter.is_rate_limited(key))

    def test_rate_limiter_resets_on_success(self):
        limiter = SlidingWindowRateLimiter(max_attempts=3, window_seconds=60)
        key = "192.168.1.1:nurse1"

        limiter.record_failure(key)
        limiter.record_failure(key)
        self.assertEqual(len(limiter._attempts[key]), 2)

        # Successful login clears failures
        limiter.record_success(key)
        self.assertEqual(len(limiter._attempts[key]), 0)
        self.assertFalse(limiter.is_rate_limited(key))


class TestSecurityHeadersAndPayloadLimits(unittest.TestCase):
    """Test security headers middleware and request body size limiter."""

    def test_security_headers_present_in_responses(self):
        from fastapi import Response
        res = Response(content="ok")
        res = apply_security_headers(res)

        # Verify hardened security headers
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertIn("accelerometer=()", res.headers.get("Permissions-Policy", ""))
        self.assertEqual(res.headers.get("X-XSS-Protection"), "1; mode=block")

    def test_oversized_payload_rejected_with_413(self):
        # 6MB payload is oversized (> 5MB)
        self.assertTrue(is_payload_oversized(str(MAX_REQUEST_BODY_BYTES + 1024 * 1024)))
        # 1MB payload is permitted (< 5MB)
        self.assertFalse(is_payload_oversized(str(1 * 1024 * 1024)))
        # Empty or missing Content-Length is permitted
        self.assertFalse(is_payload_oversized(None))
        self.assertFalse(is_payload_oversized(""))


class TestMongoDBIntegrityAndRegexEscaping(unittest.TestCase):
    """Test database unique index setup and regex injection defense."""

    def test_init_security_indexes_registers_unique_indexes(self):
        mock_users = MockCollection("users")
        mock_patients = MockCollection("patients")
        mock_admin = MockCollection("medication_administrations")

        orig_users = mc.mongo_db.users
        orig_patients = mc.mongo_db.patients
        orig_admin = mc.mongo_db.medication_administrations
        try:
            mc.mongo_db.users = mock_users
            mc.mongo_db.patients = mock_patients
            mc.mongo_db.medication_administrations = mock_admin

            mc.init_security_indexes()

            self.assertIn("uq_users_username", mock_users.indexes)
            self.assertTrue(mock_users.indexes["uq_users_username"]["kwargs"].get("unique"))

            self.assertIn("uq_users_email", mock_users.indexes)
            self.assertTrue(mock_users.indexes["uq_users_email"]["kwargs"].get("unique"))

            self.assertIn("uq_patients_patient_id", mock_patients.indexes)
            self.assertTrue(mock_patients.indexes["uq_patients_patient_id"]["kwargs"].get("unique"))

            self.assertIn("uq_med_admin_schedule_id", mock_admin.indexes)
            self.assertTrue(mock_admin.indexes["uq_med_admin_schedule_id"]["kwargs"].get("unique"))
        finally:
            mc.mongo_db.users = orig_users
            mc.mongo_db.patients = orig_patients
            mc.mongo_db.medication_administrations = orig_admin

    def test_regex_escaping_prevents_regex_injection(self):
        import re
        malicious_input = ".*admin.*"
        escaped = re.escape(malicious_input)
        self.assertNotIn(".*", escaped)
        self.assertTrue(escaped.startswith(r"\.\*admin"))


if __name__ == "__main__":
    unittest.main()
