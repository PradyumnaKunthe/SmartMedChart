# SMARTMEDCHART — ADMINISTRATOR USER MANUAL & OPERATIONAL GUIDE

**Application:** SmartMedChart  
**Target Audience:** Hospital Administrators, Medical Directors, System Operators  
**Role Required:** `admin` / `administrator`  
**Version:** 1.0.0 (Production Candidate)  

---

## 1. OVERVIEW & RESPONSIBILITIES

As a Hospital Administrator in SmartMedChart, you possess system-wide operational governance. Your responsibilities include:
- Provisioning and deprovisioning clinical staff (Doctors, Nurses, Receptionists, Pharmacists).
- Managing hospital facilities, ward configurations, and bed allocations.
- Configuring clinical grace period policies and medication monitoring thresholds.
- Overseeing hospital-wide medication compliance, adherence metrics, and clinical safety alerts.
- Monitoring system health, database latency, and token revocation registries.

---

## 2. AUTHENTICATION & ADMIN DASHBOARD

1. Navigate to the login portal at `http://localhost:5173/login` (or your hospital production URL).
2. Enter your administrative username and secure password.
3. Upon authentication, you will be automatically routed to the **Admin Monitoring Dashboard** (`/admin/dashboard`).
4. **Key Dashboard Metrics:**
   - **Total Admitted Patients:** Real-time count of active inpatient admissions.
   - **Active Prescriptions:** Current physician orders across all wards.
   - **Medication Compliance Rate:** Percentage of scheduled doses administered on time.
   - **Pending Safety Alerts:** Critical notifications requiring clinical review.

---

## 3. STAFF PROVISIONING & USER MANAGEMENT

Administrative users create and manage staff accounts through the **Staff Management** module (`/admin/staff-assignments`):

### 3.1 Creating a New Staff Member
1. Click **Add New Staff** on the top action bar.
2. Complete the required fields:
   - **Full Name:** Clinical staff member's legal name (e.g., `Dr. Gregory House`, `Nurse Jackie Peyton`).
   - **Username:** Unique hospital alphanumeric handle.
   - **Email:** Official hospital email address.
   - **Role:** Select one of:
     - `doctor`: Physician with prescription and diagnosis authority.
     - `nurse`: Bedside care and medication administration authority.
     - `receptionist`: Patient intake, ward bed admission, and CareMatch scheduling.
     - `pharmacist`: Formulary inventory and prescription dispensing.
   - **Password:** Minimum 8 characters with alphanumeric complexity.
3. Click **Create Staff Account**. The system hashes the password using Argon2/Bcrypt and persists the user record.

### 3.2 Resetting Staff Passwords
1. Locate the staff member in the Staff Directory.
2. Click **Reset Password** under the Actions column.
3. Enter the temporary passphrase and confirm. Prompt the staff member to change their password upon their next login.

---

## 4. WARD & BED INFRASTRUCTURE MANAGEMENT

Configure hospital physical layout via **Ward & Bed Management** (`/admin/wards-beds`):

### 4.1 Creating Wards
1. Select **Add Ward**.
2. Specify the **Ward Name** (e.g., `Cardiology Ward A`, `Intensive Care Unit (ICU)`, `Pediatrics 3B`).
3. Set **Ward Type** (General, ICU, Step-down, Isolation).
4. Click **Save Ward**.

### 4.2 Provisioning Beds
1. Select the target Ward from the dropdown.
2. Click **Add Bed**.
3. Enter **Bed Identifier** (e.g., `ICU-BED-01`, `WARD-A-102`).
4. The bed becomes immediately available for patient admissions via the Receptionist intake portal.

---

## 5. HOSPITAL MEDICATION MONITORING POLICY CONFIGURATION

SmartMedChart allows administrators to establish clinical grace windows for medication administration adherence via **Medication Monitoring** (`/admin/medication-monitoring`):

1. Navigate to the **Monitoring Policy** tab.
2. Adjust the clinical timing parameters:
   - **Grace Period Before Dose (`on_time_grace_before_minutes`):** Minutes before scheduled time when a dose may be administered early (Default: `15`).
   - **Grace Period After Dose (`on_time_grace_after_minutes`):** Minutes after scheduled time before a dose is classified as late (Default: `30`).
   - **Critical Overdue Threshold (`critical_overdue_minutes`):** Minutes after scheduled time before an escalated safety alert is generated (Default: `60`).
   - **Missed Dose Cutoff (`missed_dose_threshold_minutes`):** Minutes after scheduled time when an unadministered dose is automatically flagged as missed (Default: `120`).
3. Click **Update Hospital Policy**. The system applies these rules hospital-wide without requiring a server restart.

---

## 6. SYSTEM HEALTH & AUDIT TELEMETRY

Administrators can evaluate database health and API responsiveness:
- **Liveness Probe:** `GET /healthz` verifies web process health.
- **Readiness Probe:** `GET /readyz` verifies MongoDB Atlas connectivity and ping latency.
- **Diagnostics API:** `GET /api/mongodb-status` provides real-time document counts across collections and connection pool state.
