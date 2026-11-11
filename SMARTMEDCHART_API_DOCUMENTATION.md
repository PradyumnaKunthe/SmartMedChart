# SMARTMEDCHART — COMPREHENSIVE API SPECIFICATION & REFERENCE

**Application:** SmartMedChart  
**Version:** 1.0.0  
**Base URL (Local):** `http://localhost:8000`  
**Base URL (Production):** `https://smartmedchart-api.onrender.com`  
**Specification Type:** RESTful JSON API  
**Total Endpoint Operations:** 117 across 16 Routers  

---

## 1. GLOBAL CONVENTIONS & SECURITY HEADERS

### Authentication Header
All protected endpoints require an HTTP Bearer JWT token in the `Authorization` header:
```http
Authorization: Bearer <jwt_access_token>
```

### Standard Error Responses
| Status Code | Reason | Typical Payload |
|---|---|---|
| `400 Bad Request` | Validation failure or malformed payload | `{"detail": "Invalid input data: ..."}` |
| `401 Unauthorized` | Missing token, expired token, or token revoked | `{"detail": "Could not validate credentials"}` |
| `403 Forbidden` | Insufficient role or out-of-scope patient access | `{"detail": "Forbidden: Clinical access out of scope"}` |
| `404 Not Found` | Target record or resource does not exist | `{"detail": "Resource not found"}` |
| `409 Conflict` | Unique constraint violation (duplicate key) | `{"detail": "Record with this key already exists"}` |
| `413 Payload Too Large` | Request body exceeds 10MB limit | `{"detail": "Payload too large. Max 10MB"}` |
| `429 Too Many Requests` | Rate limit threshold exceeded | `{"detail": "Rate limit exceeded. Try again in 10 minutes"}` |

---

## 2. API ENDPOINTS BY ROUTER

### 2.1 System & Diagnostic Endpoints
- `GET /` — Root health and version check. Anonymous access.
- `GET /healthz` — Basic liveness probe for container orchestrator. Anonymous access.
- `GET /readyz` — Readiness probe checking database ping. Anonymous access.
- `GET /api/mongodb-status` — Detailed database diagnostic status and collection telemetry. Restricted to `MANAGE_SYSTEM` (Admin).

### 2.2 Authentication Router (`/api/auth`)
- `POST /api/auth/login` — User authentication via username/password. Returns JWT access token and user profile. Protected by sliding-window rate limiter (10 attempts / 10 min).
- `POST /api/auth/logout` — Revokes current session token by storing `jti` in MongoDB `revoked_tokens` collection. Requires valid Bearer token.
- `GET /api/auth/me` — Retrieves authenticated user profile, assigned role, and permissions.
- `POST /api/auth/register-staff` — Registers new hospital staff member. Restricted to `MANAGE_STAFF` (Admin).
- `POST /api/auth/change-password` — Updates password for currently logged-in user.
- `POST /api/auth/reset-password` — Admin administrative password reset. Restricted to `MANAGE_STAFF`.

### 2.3 Doctor Router (`/api/doctor`)
- `GET /api/doctor/dashboard` — Doctor clinical overview (active patients, pending reviews, assigned encounters). Restricted to `VIEW_PATIENT`.
- `GET /api/doctor/patients` — List of inpatients assigned to attending physician. Restricted to `VIEW_PATIENT`.
- `GET /api/doctor/patients/{id}` — In-depth patient clinical record, vitals, active prescriptions, and encounter history. Scoped to attending doctor.
- `GET /api/doctor/round-patients` — Ward round patient roster. Note: `qr_token` stripped for security; returns `qr_is_active: bool`.
- `POST /api/doctor/prescriptions` — Creates new clinical prescription with items, dosages, frequencies, and administration routes. Restricted to `CREATE_PRESCRIPTION`.
- `GET /api/doctor/prescriptions` — List of prescriptions authored by or assigned to doctor. Restricted to `VIEW_PRESCRIPTION`.
- `GET /api/doctor/prescriptions/{id}` — Details of specific prescription.
- `PUT /api/doctor/prescriptions/{id}` — Updates active prescription details. Scoped to authoring doctor.
- `DELETE /api/doctor/prescriptions/{id}` — Discontinues prescription. Requires `DISCONTINUE_PRESCRIPTION`.
- `POST /api/doctor/patients/{id}/clinical-notes` — Appends progress note or round observation. Scoped to doctor.
- `POST /api/doctor/patients/{id}/vitals` — Records bedside vital signs. Scoped to clinical staff.
- `POST /api/doctor/patients/{id}/allergies` — Adds allergy with severity and manifestation. Restricted to clinical roles (`CREATE_PRESCRIPTION`).
- `PUT /api/doctor/patients/{id}/allergies/{allergy_id}` — Updates allergy record. Restricted to clinical roles.
- `DELETE /api/doctor/patients/{id}/allergies/{allergy_id}` — Soft-archives allergy record (`archival_status: ARCHIVED`). Restricted to clinical roles.

### 2.4 Nurse Router (`/api/nurse` & `/api/nurse-qr`)
- `GET /api/nurse/dashboard` — Nursing ward overview, assigned beds, upcoming doses, and shift alerts.
- `GET /api/nurse/patients` — Inpatients assigned to current nurse's care. Physical `qr_token` stripped; returns `qr_is_active: bool`.
- `GET /api/nurse/patients/{id}` — Inpatient chart, nursing notes, and active medication schedule.
- `GET /api/nurse/medications` — Scheduled medication doses for nurse's assigned patients. Features pagination (`page`, `limit`), index-backed sorting, and bulk context pre-fetching (`_batch_schedule_contexts`).
- `GET /api/nurse/medications/{id}` — Detailed information for a single scheduled medication dose.
- `POST /api/nurse/medications/{id}/administer` — Bedside administration confirmation ("Mark as Given"). Enforces 15-minute physical QR verification window. Calculates on-time/late status automatically via `compute_monitoring_status()`.
- `POST /api/nurse/medications/{id}/hold` — Places medication dose on clinical hold. Unassigned covering nurses must supply non-empty `override_reason` and have active bedside scan.
- `POST /api/nurse/medications/{id}/unhold` — Resumes held medication dose.
- `POST /api/nurse-qr/verify-patient` — Verifies scanned wristband QR token; initiates 15-minute proximity authorization session.

### 2.5 Pharmacy Router (`/api/pharmacy`)
- `GET /api/pharmacy/inventory` — Complete drug inventory, current stock, reorder levels, and batch expiry. Restricted to `VIEW_PHARMACY`.
- `POST /api/pharmacy/inventory` — Adds new medication item to formulary catalogue. Restricted to `MANAGE_PHARMACY`.
- `PUT /api/pharmacy/inventory/{id}` — Updates stock counts, reorder thresholds, or unit pricing.
- `GET /api/pharmacy/prescriptions` — Inpatient prescriptions awaiting dispensing. Restricted to `VIEW_PHARMACY`.
- `POST /api/pharmacy/dispense` — Dispenses medication against active prescription. Validates prescription authenticity, deducts stock, and records batch audit transaction. Restricted to `DISPENSE_MEDICATION`.
- `GET /api/pharmacy/transactions` — Audit trail of stock receipts, dispensations, and adjustments.

### 2.6 Hospital & Receptionist Router (`/api/hospital`)
- `POST /api/hospital/patients` — Inpatient intake and registration. Requires `CREATE_PATIENT` or `MANAGE_PATIENTS`. Performs duplicate checks against phone and MRN. Generates cryptographically secure `qr_token`.
- `GET /api/hospital/patients` — Search and roster of hospital patients. Restricted to `VIEW_PATIENT`.
- `GET /api/hospital/patients/{id}` — Detailed patient demographic and admission profile.
- `PUT /api/hospital/patients/{id}` — Updates demographic or insurance information. Requires `EDIT_PATIENT`.
- `POST /api/hospital/admissions` — Admits patient to inpatient ward and assigns available bed.
- `POST /api/hospital/discharges/{id}` — Discharges patient, releases bed, and closes active encounter.
- `GET /api/hospital/wards` — List of hospital wards and occupancy rates.
- `POST /api/hospital/wards` — Creates new ward. Restricted to `MANAGE_WARDS`.
- `GET /api/hospital/beds` — Real-time list of all hospital beds and current occupancy status.
- `POST /api/hospital/beds` — Adds new bed to ward. Restricted to `MANAGE_WARDS`.

### 2.7 CareMatch Router (`/api/carematch`)
- `GET /api/carematch/doctors` — Directory of available doctors, specialties, and outpatient consultation schedules.
- `GET /api/carematch/slots` — Real-time query for unreserved appointment slots for a specific doctor and date.
- `POST /api/carematch/appointments` — Books patient appointment. Enforces atomic slot reservation via unique compound index (`doctor_id`, `appointment_date`, `appointment_time`).

### 2.8 Monitoring & Safety Router (`/api/monitoring` & `/api/safety`)
- `GET /api/monitoring/schedules` — Medication administration tracking across active inpatient admissions.
- `GET /api/monitoring/policy` — Retrieves hospital administration grace period policy and alerting thresholds.
- `PUT /api/monitoring/policy` — Updates hospital policy. Enforces typed Pydantic schema `HospitalPolicyUpdateRequest(extra="forbid")` with strict numeric validation. Restricted to `MANAGE_SYSTEM`.
- `GET /api/monitoring/alerts` — Real-time clinical safety alerts (missed doses, drug interactions, vitals contraindications). Role-scoped.
- `POST /api/monitoring/alerts/{id}/acknowledge` — Acknowledges clinical alert. Scoped to assigned clinical staff.
- `GET /api/safety/checks` — Evaluates safety checks between pending prescriptions and patient allergies.

### 2.9 Dashboard Router (`/api/dashboard`)
- `GET /api/dashboard/medication-summary` — High-level medication adherence KPIs. Strictly scoped via `get_dashboard_authorized_patient_scope()` (Doctors: assigned encounters/Rx; Nurses: assigned beds/scanned patients; Non-clinical: 403 Forbidden; Admin: hospital-wide).
- `GET /api/dashboard/monitoring-schedules` — Scoped schedule tracking.
- `GET /api/dashboard/ai-monitoring` — Scoped clinical risk AI summary.
- `GET /api/dashboard/administration-monitoring` — Scoped dose administration metrics.
- `GET /api/dashboard/safety-monitoring` — Scoped clinical safety alert summary.

### 2.10 AI & Chatbot Router (`/api/ai` & `/api/chat`)
- `GET /api/ai/predictions` — Machine learning risk predictions for medication non-adherence and clinical deterioration. Features pagination and role-based patient scoping.
- `POST /api/chat/message` — Interactive clinical chatbot assistant. Scoped strictly to patient records assigned to calling user; rejects cross-patient PHI harvesting queries.
