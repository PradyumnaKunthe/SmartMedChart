# SMARTMEDCHART — PHYSICIAN CLINICAL MANUAL & PRESCRIBING GUIDE

**Application:** SmartMedChart  
**Target Audience:** Attending Physicians, Hospitalists, Resident Doctors, Medical Specialists  
**Role Required:** `doctor`  
**Version:** 1.0.0 (Production Candidate)  

---

## 1. CLINICAL WORKSPACE OVERVIEW

SmartMedChart empowers physicians with real-time patient charts, automated allergy warnings, safe e-prescribing, bedside ward round tracking, and integrated CareMatch outpatient scheduling.

Physicians access:
- **Doctor Dashboard (`/doctor/dashboard`):** Real-time summary of admitted patients under your care.
- **Patient Directory (`/doctor/patients`):** Master roster of assigned inpatients with active diagnoses and vitals.
- **Doctor On Round (`/doctor/round`):** Streamlined bedside rounding interface optimized for tablet and mobile carts.
- **Prescription Center (`/doctor/prescriptions`):** Active and historical prescription authoring and review.
- **Clinical AI Assistant (`/doctor/ai`):** Evidence-based patient risk summaries and adherence warnings.

---

## 2. PATIENT REVIEW & CLINICAL ROUNDING

### 2.1 Daily Ward Rounds ("Doctor On Round")
1. Open **Doctor On Round** (`/doctor/round`) on your workstation or tablet.
2. The system displays your assigned inpatients grouped by ward and bed number.
3. Select a patient card to open the quick-chart view:
   - Review recent vital sign trends (BP, Heart Rate, SpO2, Temperature).
   - Check medication administration history (verify which doses were given, late, or held by nursing staff).
   - Add a progress note under **Clinical Round Notes**.
4. Click **Next Patient** to proceed through your clinical rounds efficiently.

### 2.2 Managing Patient Allergies
1. Open the patient profile at `/doctor/patients/{id}`.
2. Under the **Allergies** section, click **Add Allergy**.
3. Specify:
   - **Allergen:** Name of pharmaceutical or dietary substance (e.g., `Penicillin`, `Sulfa`, `NSAIDs`).
   - **Severity:** `MILD`, `MODERATE`, `SEVERE`, `ANAPHYLACTIC`.
   - **Reaction / Symptoms:** Observed reactions (e.g., `Urticaria`, `Bronchospasm`).
4. Click **Save Allergy**. The allergen is permanently bound to the patient chart and triggers automatic prescribing guards.

---

## 3. SAFE E-PRESCRIBING WORKFLOW

SmartMedChart eliminates illegible handwriting and prevents drug interactions during prescription authoring:

### 3.1 Creating a New Prescription
1. Navigate to **Prescriptions** and click **New Prescription** (`/doctor/prescriptions/new`).
2. **Select Patient:** Search by patient name or Patient ID (e.g., `PAT-1001`).
3. Enter **Primary Clinical Diagnosis** (e.g., `Bacterial Pneumonia`, `Hypertensive Crisis`).
4. **Add Prescription Items:**
   - **Medication Name:** Select approved generic or brand drug from hospital formulary.
   - **Dosage:** Enter numerical value and unit (e.g., `500 mg`, `10 ml`).
   - **Route of Administration:** Choose from `ORAL`, `INTRAVENOUS (IV)`, `INTRAMUSCULAR (IM)`, `SUBCUTANEOUS`, `TOPICAL`.
   - **Dosing Frequency:**
     - `DAILY` (Once every 24 hours at 08:00)
     - `BID` (Twice daily: 08:00, 20:00)
     - `TID` (Three times daily: 08:00, 14:00, 20:00)
     - `QID` (Four times daily: 06:00, 12:00, 18:00, 00:00)
     - `Q4H`, `Q6H`, `Q8H`, `STAT`, `PRN` (As needed)
   - **Duration:** Prescribed course duration in days (e.g., `5 days`, `7 days`).
   - **Dietary Relationship:** `BEFORE_MEAL`, `AFTER_MEAL`, `WITH_FOOD`, `EMPTY_STOMACH`.
   - **Clinical Instructions:** Specific administration notes for bedside nursing staff.
5. **Safety Verification:** The system automatically checks the selected drug against the patient's recorded allergies. If a conflict is detected, an alert modal appears requiring clinical justification or drug substitution.
6. Click **Sign and Authorize Prescription**.
7. The order transitions to `PENDING_DISPENSE` in the Pharmacy queue, and individual medication schedules are created.

### 3.2 Modifying or Discontinuing Prescriptions
- To adjust dosage or duration, locate the prescription and click **Edit Order**.
- To cancel an active order, click **Discontinue Prescription**. You must enter a clinical reason (e.g., `Adverse reaction observed`, `Therapy completed early`, `Patient discharged`). Discontinued orders halt all future unadministered doses immediately.

---

## 4. PATIENT DISCHARGE WORKFLOW

When an inpatient is clinically ready for discharge:
1. Navigate to the patient chart and click **Initiate Clinical Discharge**.
2. Enter the **Discharge Summary** and outpatient follow-up instructions.
3. Click **Confirm Discharge**. The patient record transitions to `DISCHARGED`, releasing the bed in the ward registry while archiving the inpatient stay record.
