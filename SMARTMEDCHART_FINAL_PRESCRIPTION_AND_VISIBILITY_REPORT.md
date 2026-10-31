# SmartMedChart — Final Prescription Creation & Discharged Patient Visibility Verification Report

**Date:** 2026-11-01  
**Project:** SmartMedChart (FastAPI Backend + React / Vite Frontend + MongoDB)  
**Database Isolation Verification:** Verified using isolated test database `smartmedchart_e2e_test` (`mongodb://127.0.0.1:27017/smartmedchart_e2e_test`). Production database `smartmedchart` was protected and untouched.  
**Frontend Compilation:** Production build succeeded in 6.22s with **0 compilation errors**.  
**Test Suite Execution:** 100% Passed across all automated integration tests.

---

## Executive Summary

| Issue | Title | Status | Primary Root Cause |
|---|---|---|---|
| **BUG 1** | Discharged Patients Must Appear ONLY in Admin → Discharged Patients | **FIXED** | Default endpoints (`/api/hospital/patients`, `/api/hospital/dashboard`, `/api/doctor/patients`, `/api/nurse/medications`) lacked lifecycle filters for `DISCHARGED` status; Receptionist and Doctor UI components contained unfiltered tables, "Discharged" tabs, and discharged KPI counters. |
| **BUG 2** | Doctor Page: Add / Write Prescription Not Working | **FIXED** | `CreatePrescription.jsx` did not format Pydantic validation error lists, causing React `[object Object]` rendering issues; button label was "Write Prescription" instead of "Write New Prescription"; `get_doctor_patient_or_404` raised 404 instead of 400 when attempting to prescribe for discharged patients; patient redirection on success pointed to `undefined` when entering without query parameters. |

---

## Part 1 — Bug 1: Discharged Patient Visibility Application-Wide

### 1. Root Cause Analysis
1. **Hospital & Receptionist Endpoints (`/api/hospital/patients` & `/dashboard`):**
   - In `backend/app/routes/hospital.py:get_hospital_patients`, the parameter `active_only` defaulted to `False`, issuing query `{}` to MongoDB which returned both active and discharged patients.
   - `get_hospital_dashboard` calculated `total` across all patients including historical records and exposed `inactive` counts to non-admin receptionists.
   - `frontend/src/pages/hospital/HospitalDashboard.jsx` featured a "Discharged Records" stat card and a "Discharged" filter tab that listed discharged patients to receptionists.
2. **Doctor Workspace & Round Roster (`/api/doctor/patients` & `/api/doctor/rounds/patients`):**
   - Query in `search_patients` only checked `is_active: active_filter()` without verifying `lifecycle_status != "DISCHARGED"`.
   - `frontend/src/pages/doctor/DoctorDashboard.jsx` rendered discharged patients in "Recent Inpatients" with a neutral "Discharged" badge and displayed a "Discharged Records" KPI card.
   - `frontend/src/pages/doctor/Patients.jsx` included a "Discharged" tab and "Discharged Records" stat card.
3. **Nurse Worklist & Medication Queue (`/api/nurse/patients` & `/api/nurse/medications`):**
   - In `nurse.py`, `_schedule_context` did not verify if the schedule or prescription had been cancelled/discharged, or if the patient's `lifecycle_status` was `"DISCHARGED"`, permitting cancelled schedules to leak into the medication administration queue.
4. **CareMatch Appointment Scheduling (`/api/carematch/appointments`):**
   - Allowed appointments to be booked for patients who were already discharged.
5. **Admin Patient Management Separation:**
   - There was no dedicated, exclusive endpoint for discharged patients (`/api/admin/patients/discharged`).
   - Admin `PatientManagement.jsx` defaulted to an "All Records" tab that mixed active and discharged patients in a single table.

---

### 2. Implementation Details

#### A. Backend Route Enforcements
1. **`backend/app/routes/hospital.py`**:
   - `get_hospital_patients`: Strict query enforcement:
     ```python
     query = {
         "is_active": {"$in": [True, 1]},
         "lifecycle_status": {"$ne": "DISCHARGED"},
     }
     ```
   - `get_hospital_dashboard`: Counts only active admissions; `inactive` is reported as `0` for hospital staff.
   - `patient_to_dict`: Populates explicit `"lifecycle_status"`.
2. **`backend/app/routes/admin.py`**:
   - `get_patients`: Added `"lifecycle_status": {"$ne": "DISCHARGED"}`.
   - `get_assignments`: Filters out assignments where patient is discharged or inactive.
   - `get_patient_lifecycle`: Enforces disjoint sets between `active` and `discharged`.
   - Added dedicated `@router.get("/patients/discharged")` requiring `require_permission("MANAGE_SYSTEM")` and `require_admin_permission(current_user)` to provide discharge reason, final billing, and discharge timestamp.
3. **`backend/app/routes/doctor.py`**:
   - `search_patients`: Enforces `"lifecycle_status": {"$ne": "DISCHARGED"}`.
   - `get_doctor_round_patients`: Filters roster strictly to non-discharged active inpatients.
4. **`backend/app/routes/nurse.py`**:
   - `get_nurse_assigned_patients`: Added `"lifecycle_status": {"$ne": "DISCHARGED"}`.
   - `get_nurse_patient_details`: Raises HTTP 404 for discharged/inactive patients.
   - `_schedule_context`: Excludes schedules where `schedule.status in ("CANCELLED", "DISCHARGED")`, `prescription.status in ("CANCELLED", "DISCHARGED")`, or `patient.lifecycle_status == "DISCHARGED"`.
5. **`backend/app/routes/carematch.py`**:
   - `save_carematch_appointment`: Rejects appointments for discharged patients with HTTP 400 `"Cannot book an appointment for a discharged or inactive patient."`.

#### B. Frontend Cleanups
1. **`frontend/src/pages/hospital/HospitalDashboard.jsx`**:
   - Filtered patient list to only active inpatients: `p.is_active && p.lifecycle_status !== 'DISCHARGED'`.
   - Removed the "Discharged Records" stat card.
   - Removed the "Discharged" tab from lifecycle filters; replaced with an "Active Inpatients" count pill.
2. **`frontend/src/pages/doctor/DoctorDashboard.jsx`**:
   - Filtered `recentPatients` to only active inpatients; removed "Discharged Records" stat card.
   - Removed the "Discharged" badge from recent inpatient cards.
3. **`frontend/src/pages/doctor/Patients.jsx`**:
   - Filtered directory to active inpatients only; removed "Discharged" filter button and "Discharged Records" stat card.
4. **`frontend/src/pages/admin/PatientManagement.jsx`**:
   - Changed default tab to `'active'`.
   - Removed "All Records" tab; patients are strictly divided into "Active Inpatients" and "Discharged Patients".
   - Discharged patients appear ONLY when the dedicated "Discharged Patients" tab is opened.

---

## Part 2 — Bug 2: Doctor Prescription Creation & Error Handling

### 1. Root Cause Analysis
1. **FastAPI / Pydantic Validation Error Rendering:**
   - In `CreatePrescription.jsx`, `setError` assigned `requestError?.response?.data?.detail`. When FastAPI returned 422 Unprocessable Entity or validation errors, `detail` was an array of objects `[{"loc": ..., "msg": ...}]`. React attempted to render this object directly into JSX, resulting in `[object Object]` rendering and broken UI state.
2. **Button Label and Link Mismatches:**
   - In `PatientProfile.jsx`, the primary action was labeled "Write Prescription" instead of "Write New Prescription", while secondary action was "New Prescription Order".
3. **Discharged Patient Prescription Rejection:**
   - In `doctor.py:get_doctor_patient_or_404`, when an attempt was made to prescribe for a discharged patient, the endpoint raised 404 "Patient is not assigned to this doctor." instead of HTTP 400 "Cannot create prescription for a discharged patient."
4. **Target Patient ID Undefined Navigation:**
   - In `CreatePrescription.jsx`, after successful prescription authorization, clicking "Return to Patient Chart" navigated to `/doctor/patients/${patientId}`. If the doctor entered without `?patient=...` and selected a patient from the dropdown, `patientId` was `null`, navigating to `/doctor/patients/undefined`.

---

### 2. Implementation Details

#### A. Frontend Error Handling & Form Flow
1. **`frontend/src/pages/doctor/CreatePrescription.jsx`**:
   - Implemented `formatApiError(err, fallbackMessage)`:
     ```javascript
     function formatApiError(err, fallbackMessage) {
       const detail = err?.response?.data?.detail;
       if (typeof detail === "string") return detail;
       if (Array.isArray(detail)) {
         return detail.map((d) => d?.msg || d?.message || JSON.stringify(d)).join("; ");
       }
       if (detail && typeof detail === "object") {
         return detail?.message || detail?.msg || JSON.stringify(detail);
       }
       return err?.message || fallbackMessage;
     }
     ```
   - Used `formatApiError` in `handleSubmit`, `loadData`, and `handleSelectPatientChange`.
   - Added pre-submission frontend validations for `medicine_id` and `dose` to give immediate feedback.
   - Disabled the authorize button during `submitting`, with loading spinner reset in `finally`.
   - Updated success card redirection:
     ```javascript
     const targetPid = selectedPatientId || patientId || patient?.id;
     navigate(targetPid ? `/doctor/patients/${targetPid}` : "/doctor/patients");
     ```
2. **`frontend/src/pages/doctor/PatientProfile.jsx`**:
   - Standardized button label to **"Write New Prescription"** alongside **"New Prescription Order"**.
   - Both buttons invoke `handleCreatePrescription()`, correctly passing target patient ID to `/doctor/prescriptions/create?patient=${targetId}`.

#### B. Backend Prescription Authorization & Security
1. **`backend/app/routes/doctor.py`**:
   - Updated `get_doctor_patient_or_404`:
     - Checks if patient exists (404 "Patient not found.").
     - Checks `not is_active` or `lifecycle_status == "DISCHARGED"` (raises **HTTP 400 "Cannot create prescription for a discharged patient."**).
     - Checks active encounter assignment to current doctor (raises HTTP 403 "Patient is not assigned to this doctor.").
   - Preserved `get_doctor_patient_history_or_404` for `GET /api/doctor/patients/{patient_id}/prescriptions`, ensuring historical prescriptions remain readable after discharge.
   - Confirmed zero inventory deduction on prescription creation (inventory is deducted upon nursing administration).
   - Duplicate prescription detection: Rejects identical active prescription with HTTP 409.

---

## Part 3 — Application-Wide Visibility Matrix

| Application Section | Discharged Patient Visibility | Active Inpatient Visibility | Implementation Status |
|---|---|---|---|
| **Admin → Active Patients** | **HIDDEN** | **VISIBLE** | Verified via `/api/admin/patients` |
| **Admin → Discharged Patients** | **VISIBLE** | **HIDDEN** | Verified via dedicated `/api/admin/patients/discharged` |
| **Receptionist Dashboard** | **HIDDEN** | **VISIBLE** | Verified via `/api/hospital/dashboard` |
| **Receptionist → All Patients** | **HIDDEN** | **VISIBLE** | Verified via `/api/hospital/patients` |
| **Hospital Dashboard** | **HIDDEN** | **VISIBLE** | Verified via `HospitalDashboard.jsx` |
| **Doctor Dashboard** | **HIDDEN** | **VISIBLE** | Verified via `DoctorDashboard.jsx` |
| **Doctor Patients Directory** | **HIDDEN** | **VISIBLE** | Verified via `/api/doctor/patients` |
| **Doctor On-Round Patients** | **HIDDEN** | **VISIBLE** | Verified via `/api/doctor/rounds/patients` |
| **Nurse Dashboard** | **HIDDEN** | **VISIBLE** | Verified via `/api/nurse/patients` |
| **Nurse Medication Queue** | **HIDDEN** | **VISIBLE** | Verified via `/api/nurse/medications` |
| **Nurse Bedside Details** | **HIDDEN (404)** | **VISIBLE** | Verified via `/api/nurse/patients/{id}` |
| **CareMatch Appointment** | **BLOCKED (400)** | **ALLOWED** | Verified via `/api/carematch/appointments` |
| **Doctor Prescription Creation** | **BLOCKED (400)** | **ALLOWED** | Verified via `/api/doctor/prescriptions` |
| **Doctor Historical Prescriptions**| **READABLE** | **READABLE** | Verified via `/api/doctor/patients/{id}/prescriptions`|

---

## Part 4 — Verification Test Suite Execution Results

Automated test runner executed via `.venv\Scripts\python.exe backend/test_discharged_visibility_and_prescription.py`:

```
================================================================================
SMARTMEDCHART E2E VERIFICATION SUITE
BUG 1: Discharged Patient Visibility Application-Wide
BUG 2: Doctor Prescription Creation & Error Handling
Target Database: smartmedchart_e2e_test
================================================================================
[AUTH] Doctor: ankush_singh_test (ID: 102)
[AUTH] Admin: admin_tester (ID: 101)
[AUTH] Nurse: nupur_test (ID: 103)
[AUTH] Receptionist: receptionist (ID: 301)

--- TEST 1: Register Inpatient A and Inpatient B ---
[PASS] Test patients A (ARUN SHARMA) and B (PRIYA PATEL) established in test database.

--- TEST 2: Write Prescription for Active Patient A ---
[PASS] Prescription #100003 successfully authorized with 6 schedules.
[PASS] Zero inventory deduction confirmed: stock remains 250.
[PASS] Duplicate prescription blocked with HTTP 409: An active prescription for METFORMIN (500 mg) already exists for this patient. Please review active regimens to avoid duplicate orders.

--- TEST 3: Discharge Patient A ---
[PASS] Patient A discharged successfully.
[PASS] Bed assignment released and cleared in database.
[PASS] Active prescriptions closed with status DISCHARGED.
[PASS] All 6 medication schedules cancelled upon discharge.

--- TEST 4: Verify Discharged Patient Visibility Application-Wide ---
[PASS] Receptionist /api/hospital/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.
[PASS] Receptionist /api/hospital/dashboard: Counts only active inpatients.
[PASS] Doctor /api/doctor/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.
[PASS] Doctor /api/doctor/rounds/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.
[PASS] Nurse /api/nurse/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.
[PASS] Nurse /api/nurse/medications: Discharged Patient A schedules completely absent from queue.
[PASS] Nurse /api/nurse/patients/7001 rejected with HTTP 404: Patient not found or inactive.
[PASS] CareMatch appointment booking for discharged patient blocked with HTTP 400: Cannot book an appointment for a discharged or inactive patient.
[PASS] Admin /api/admin/patients: Discharged Patient A HIDDEN, Active Patient B VISIBLE.
[PASS] Admin /api/admin/assignments: Discharged Patient A HIDDEN from active assignments.
[PASS] Admin /api/admin/patients/discharged: Exclusively lists 3 discharged patient(s) including Patient A.
[PASS] Admin /api/admin/patients/lifecycle: Strict separation verified (Active: Patient B, Discharged: Patient A).

--- TEST 5: Verify Prescription Creation and Error Handling (BUG 2) ---
[PASS] Prescribing for discharged patient A rejected with HTTP 400: 'Cannot create prescription for a discharged patient.'.
[PASS] Historical prescriptions for discharged Patient A preserved and readable (Found 1 records).
[PASS] Successfully wrote prescription #100004 for Active Patient B with 5 schedules.

--- TEST 6: Verify MongoDB Data Preservation ---
[PASS] Full clinical history, prescriptions, encounters, schedules, and billing preserved in MongoDB without deletion.

================================================================================
ALL TESTS PASSED: 100% SUCCESS (BUG 1 & BUG 2 RESOLVED)
================================================================================
```

---

## Part 5 — Database Safety & Data Preservation Confirmation

1. **Isolation Confirmation:**
   - All tests and schema operations were performed exclusively on `smartmedchart_e2e_test`.
   - The primary production database `smartmedchart` was not altered.
2. **Zero Permanent Deletions:**
   - Patients discharged through the lifecycle undergo status transition (`is_active: False`, `lifecycle_status: "DISCHARGED"`).
   - Historical records in `patients`, `encounters`, `prescriptions`, `prescription_items`, `medication_schedules`, `patient_billing`, and `patient_round_assessments` are 100% preserved in MongoDB.
3. **Bed De-allocation:**
   - Bed occupancy was cleared (`is_occupied: 0`, `occupied_by_patient_id: None`), making the bed immediately available for new admissions.
4. **Prescription & Schedule De-activation:**
   - Active prescriptions were updated to `"DISCHARGED"`.
   - Unadministered upcoming medication schedules were transitioned to `"CANCELLED"`.

---

## Conclusion

Both **BUG 1** (Discharged Patient Visibility) and **BUG 2** (Doctor Prescription Creation) have been fully fixed and verified end-to-end. Discharged patients appear strictly in **Admin Dashboard → Discharged Patients**, and doctors can cleanly write prescriptions with automated schedule generation, robust error formatting, duplicate protection, and zero inventory leakage.

