# SMARTMEDCHART — ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS MATRIX

**Application:** SmartMedChart  
**Version:** 1.0.0  
**Security Standard:** Principle of Least Privilege (PoLP) & HIPAA/HITECH Compliance  
**Document Classification:** Security & Authorization Specification  
**Last Updated:** November 11, 2026  

---

## 1. USER ROLES & SCOPE DEFINITIONS

SmartMedChart enforces granular role-based authorization coupled with runtime object-level access controls:

| Role Identifier | Role Title | Clinical Scope & Authorization Boundaries |
|---|---|---|
| `admin` / `administrator` | System Administrator | Full hospital-wide administrative oversight. Manages user accounts, ward allocations, policy thresholds, and system health. Strictly isolated from patient bedside administration. |
| `doctor` | Attending Physician | Clinical management of assigned inpatients and outpatient consults. Authorizes prescriptions, clinical notes, allergy profiles, and discharge summaries. |
| `nurse` | Bedside Nurse | Inpatient ward care and Barcode Medication Administration (BCMA). Restricted to assigned patients or active bedside proximity scans ($\le 15$ min). |
| `receptionist` / `hospital` | Front Desk & Admissions | Patient intake, demographic entry, ward/bed admission, wristband issuance, and CareMatch outpatient booking. No access to clinical notes or prescription authoring. |
| `pharmacist` | Hospital Pharmacist | Formulary catalogue, batch tracking, inventory receipt, and prescription dispensing validation. No access to bedside administration. |

---

## 2. GRANULAR PERMISSION DEFINITIONS

The platform defines 24 granular permissions grouped by clinical domain:

- **Patient Domain:** `VIEW_PATIENT`, `CREATE_PATIENT`, `EDIT_PATIENT`, `DISCHARGE_PATIENT`
- **Prescription Domain:** `VIEW_PRESCRIPTION`, `CREATE_PRESCRIPTION`, `EDIT_PRESCRIPTION`, `DISCONTINUE_PRESCRIPTION`
- **Medication Administration (BCMA) Domain:** `VIEW_MEDICATION_ADMINISTRATION`, `ADMINISTER_MEDICATION`, `RECORD_MEDICATION_ADMINISTRATION`
- **Pharmacy & Inventory Domain:** `VIEW_PHARMACY`, `MANAGE_PHARMACY`, `DISPENSE_MEDICATION`
- **Wards & Beds Domain:** `VIEW_WARDS`, `MANAGE_WARDS`
- **CareMatch & Appointments Domain:** `VIEW_APPOINTMENTS`, `BOOK_APPOINTMENT`
- **Administrative & System Domain:** `VIEW_STAFF`, `MANAGE_STAFF`, `MANAGE_SYSTEM`, `VIEW_ANALYTICS`, `USE_AI_ASSISTANT`

---

## 3. ROLE-TO-PERMISSION MAPPING MATRIX

| Permission Key | Administrator | Doctor | Nurse | Receptionist | Pharmacist |
|---|:---:|:---:|:---:|:---:|:---:|
| `VIEW_PATIENT` | **YES** | **YES** | **YES** | **YES** | **YES** |
| `CREATE_PATIENT` | **YES** | No | No | **YES** | No |
| `EDIT_PATIENT` | **YES** | No | No | **YES** | No |
| `DISCHARGE_PATIENT` | **YES** | **YES** | No | **YES** | No |
| `VIEW_PRESCRIPTION` | **YES** | **YES** | **YES** | No | **YES** |
| `CREATE_PRESCRIPTION` | No | **YES** | No | No | No |
| `EDIT_PRESCRIPTION` | No | **YES** | No | No | No |
| `DISCONTINUE_PRESCRIPTION` | No | **YES** | No | No | No |
| `VIEW_MEDICATION_ADMINISTRATION`| **YES** | **YES** | **YES** | No | **YES** |
| `ADMINISTER_MEDICATION` | No | No | **YES** | No | No |
| `RECORD_MEDICATION_ADMINISTRATION`| No | No | **YES** | No | No |
| `VIEW_PHARMACY` | **YES** | No | No | No | **YES** |
| `MANAGE_PHARMACY` | **YES** | No | No | No | **YES** |
| `DISPENSE_MEDICATION` | No | No | No | No | **YES** |
| `VIEW_WARDS` | **YES** | **YES** | **YES** | **YES** | No |
| `MANAGE_WARDS` | **YES** | No | No | No | No |
| `VIEW_STAFF` | **YES** | No | No | No | No |
| `MANAGE_STAFF` | **YES** | No | No | No | No |
| `MANAGE_SYSTEM` | **YES** | No | No | No | No |
| `VIEW_ANALYTICS` | **YES** | **YES** | No | No | No |
| `USE_AI_ASSISTANT` | **YES** | **YES** | **YES** | No | No |
| `VIEW_APPOINTMENTS` | **YES** | **YES** | No | **YES** | No |
| `BOOK_APPOINTMENT` | **YES** | No | No | **YES** | No |

---

## 4. OBJECT-LEVEL AUTHORIZATION & CLINICAL SCOPING RULES

In addition to static role permissions, SmartMedChart implements dynamic runtime scoping rules:

### 4.1 Attending Doctor Patient Scoping (`dashboard.py`, `doctor.py`, `chat.py`)
- When a doctor queries dashboard analytics, active patient rosters, or clinical notes, the backend dynamically evaluates:
  $$	ext{Scope} = \{p \in 	ext{Patients} \mid \exists e \in 	ext{Encounters}: e.	ext{patient\_id} = p.	ext{id} \land e.	ext{doctor\_id} = u.	ext{id} \land e.	ext{status} = 	ext{"ACTIVE"}\}$$
- Doctors cannot inspect medical records or active medication charts of patients assigned to other physicians unless explicitly scheduled via CareMatch consults.

### 4.2 Bedside Nurse Proximity & Assignment Scoping (`nurse.py`, `nurse_qr.py`)
- Nurses can only administer medications or place doses on hold for:
  1. Inpatients admitted to beds within the nurse's active ward assignment.
  2. Inpatients for whom the nurse has scanned a physical wristband QR code within the previous 15 minutes.
- Unassigned covering nurses attempting an administrative hold must supply an explicit `override_reason`.

### 4.3 Chatbot Context Isolation (`chat.py`)
- The clinical AI chatbot queries strictly filter against the caller's authorized patient scope. Any attempt by unauthorized personnel to extract PHI across unassigned patients is immediately rejected with an audit log entry.
