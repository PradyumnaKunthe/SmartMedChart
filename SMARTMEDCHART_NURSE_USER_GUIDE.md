# SMARTMEDCHART — NURSING CLINICAL MANUAL & BEDSIDE BCMA GUIDE

**Application:** SmartMedChart  
**Target Audience:** Registered Nurses (RN), Staff Nurses, Charge Nurses  
**Role Required:** `nurse`  
**Version:** 1.0.0 (Production Candidate)  

---

## 1. NURSING ROLES & THE "FIVE RIGHTS" OF MEDICATION

SmartMedChart is engineered to prevent bedside medication errors. The platform automates the Seven Rights of Medication Administration:
1. **Right Patient:** Verified via wristband QR code scanning.
2. **Right Drug:** Matched against physician prescription orders.
3. **Right Dose:** Prescribed strength and quantity displayed clearly.
4. **Right Route:** Oral, IV, IM, etc., indicated on the administration card.
5. **Right Time:** Smart Medication Countdown timer tracks remaining grace windows.
6. **Right Documentation:** Instantaneous timestamped audit record in MongoDB.
7. **Right Reason / Clinical Rationale:** Confirmed prior to unholding or overriding doses.

---

## 2. SHIFT COMMENCEMENT & NURSE DASHBOARD

1. Log into SmartMedChart at `/login` using your nurse credentials.
2. The **Nurse Dashboard** (`/nurse/dashboard`) displays:
   - **Assigned Inpatients:** Patients admitted to beds under your shift assignment.
   - **Doses Due in Next 60 Minutes:** High-priority upcoming doses.
   - **Active Clinical Alerts:** Missed doses or vital sign contraindications.
   - **Bedside Proximity Status:** Indicates whether an active bedside session is open.

---

## 3. BEDSIDE WRISTBAND QR SCANNING WORKFLOW

To administer medications or view sensitive bedside charts, physical proximity must be verified:

1. Bring the bedside tablet or Mobile COW (Computer on Wheels) to the patient's bedside.
2. Click **Scan Patient Wristband** in the top navigation bar (`/nurse/qr-scanner`).
3. Align the camera viewfinder with the QR code printed on the patient's wristband.
4. Upon detection:
   - A chime confirms successful barcode recognition.
   - The patient's name, photo, MRN, date of birth, and recorded allergies are displayed on screen.
   - A **15-Minute Bedside Proximity Session** is initiated.
5. If the scan expires during patient care, a warning will indicate that a re-scan is required before confirming dose administration.

---

## 4. SMART MEDICATION COUNTDOWN

Once a patient is verified at the bedside, the **Smart Medication Countdown** interface opens automatically:

- **Schedule Cards:** Each scheduled medicine dose for the current 24-hour cycle is presented in chronological order.
- **Countdown Indicators:**
  - `UPCOMING` (Blue): Dose is scheduled for later in the shift. The real-time countdown timer shows hours and minutes remaining.
  - `DUE` (Amber): Within the 15-minute pre-dose grace window. Dose is ready for administration.
  - `OVERDUE` (Red): Dose is past the 30-minute post-dose grace window. Immediate attention required.
  - `MISSED` (Dark Red): Dose is over 120 minutes past scheduled time without administration or hold documentation.
  - `GIVEN` (Green): Dose was administered. Displays time and nurse name.
  - `HELD` (Gray): Dose was placed on clinical hold with recorded justification.

---

## 5. ADMINISTERING MEDICATIONS ("MARK AS GIVEN")

1. Verify patient identity verbally using two patient identifiers (Name & DOB).
2. Physically inspect the medication packaging, dosage, and route against the screen instructions.
3. Administer the medication to the patient.
4. Click **Mark as Given** on the corresponding schedule card.
5. The system automatically computes the adherence classification:
   - If administered between $-15$ min and $+30$ min of scheduled time: recorded as `ON_TIME`.
   - If administered $> 30$ min after scheduled time: recorded as `LATE`.
   - If administered $> 15$ min before scheduled time: recorded as `EARLY`.
6. A success message confirms the dose is permanently recorded in `medication_administrations`.

---

## 6. MEDICATION HOLD & COVERING OVERRIDE WORKFLOW

If a medication cannot be given (e.g., patient is NPO for surgery, vomiting, or vitals are contraindicative):

1. Click **Hold Dose** on the medication card.
2. Select a standardized clinical reason:
   - `Patient NPO for Procedure`
   - `Vitals Contraindication (e.g., Low Heart Rate / Blood Pressure)`
   - `Patient Refused Dose`
   - `Awaiting Lab Results`
   - `Medication Unavailable / Awaiting Pharmacy`
3. If you are covering for another nurse and are not permanently assigned to this patient's bed:
   - You must have scanned the patient's wristband within 15 minutes.
   - You **must enter an explicit clinical override reason** in the text area (e.g., `Covering for RN Smith during lunch break; verified BP prior to hold`).
4. Click **Confirm Hold**. The dose status changes to `HELD` and an audit note is logged.
