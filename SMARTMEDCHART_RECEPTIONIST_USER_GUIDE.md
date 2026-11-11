# SMARTMEDCHART — RECEPTIONIST & ADMISSIONS OPERATIONAL MANUAL

**Application:** SmartMedChart  
**Target Audience:** Hospital Receptionists, Patient Access Representatives, Admissions Clerks  
**Role Required:** `receptionist` / `hospital` / `hospital_staff`  
**Version:** 1.0.0 (Production Candidate)  

---

## 1. FRONT DESK RESPONSIBILITIES

Hospital Receptionists serve as the initial point of contact for patient registration, inpatient admissions, and outpatient consultation scheduling. Responsibilities include:
- Registering new patients while preventing duplicate Master Patient Index (MPI) entries.
- Admitting inpatients to available ward beds based on clinical specialty.
- Generating and printing patient wristbands with cryptographically secure QR codes.
- Booking outpatient specialist appointments through the CareMatch engine.

---

## 2. PATIENT INTAKE & REGISTRATION

1. Log into SmartMedChart at `/login` using your receptionist credentials.
2. Navigate to **Patient Registration** (`/hospital/add-patient`).
3. **Enter Patient Demographics:**
   - **First Name & Last Name:** Patient's legal name.
   - **Date of Birth:** `YYYY-MM-DD`.
   - **Gender:** `Male`, `Female`, `Other`.
   - **Phone Number:** 10-digit primary contact number.
   - **Address:** Residential address.
   - **Emergency Contact:** Next of kin name, relationship, and contact telephone.
4. **Duplicate Detection:**
   - As you type the phone number or name, the system queries existing records.
   - If a matching record is detected, a warning appears displaying the existing Patient ID. Do not register a second account for an existing patient; open the existing record instead.
5. Click **Register Patient**. The system assigns a unique Patient ID (e.g., `PAT-1042`) and generates a secure wristband QR token.

---

## 3. INPATIENT ADMISSION & BED ASSIGNMENT

When a registered patient requires inpatient admission:
1. Search for the patient in the **Hospital Directory** (`/hospital/dashboard`).
2. Click **Admit Patient**.
3. **Select Ward:** Choose the appropriate department (e.g., `General Ward A`, `Surgical Ward 2`, `Pediatrics`).
4. **Select Available Bed:**
   - The dropdown displays only unreserved, vacant beds in that ward.
   - Select the designated bed (e.g., `BED-104`).
5. **Assign Attending Doctor:** Choose the primary admitting physician from the doctor directory.
6. Click **Confirm Admission**.
7. An active `encounter` is created, and the bed status transitions to occupied.

---

## 4. PATIENT WRISTBAND QR CODE GENERATION & PRINTING

Accurate wristband printing is mandatory for bedside medication safety:
1. Immediately following admission (or from the patient chart), click **Print Patient Wristband**.
2. The print preview opens displaying:
   - Hospital Header: SmartMedChart Hospital.
   - Patient Full Name & Age/Gender.
   - Patient ID Code and Inpatient Encounter Number.
   - High-contrast Barcode/QR Code encoding the secure proximity token.
3. Send the print job to the designated thermal wristband printer (Zebra / Brother medical printer).
4. Affix the wristband securely to the patient's wrist upon room transfer.

---

## 5. CAREMATCH OUTPATIENT APPOINTMENT SCHEDULING

To book an outpatient consultation with a specialist:
1. Navigate to **CareMatch** (`/hospital/carematch`).
2. Search for the patient by name or Patient ID.
3. **Select Specialty & Doctor:** Filter by department (e.g., `Cardiology`, `Neurology`, `Orthopedics`) and choose the attending physician.
4. **Select Date & Time Slot:**
   - The calendar displays available 30-minute consultation slots.
   - Grayed-out slots indicate booked appointments.
5. Enter **Consultation Reason** (e.g., `Routine follow-up`, `Chest tightness review`).
6. Click **Book Appointment**.
7. The appointment is atomically saved in `carematch_appointments` and appears on the doctor's outpatient schedule.
