# SMARTMEDCHART — PHARMACY DISPENSARY & INVENTORY MANUAL

**Application:** SmartMedChart  
**Target Audience:** Chief Pharmacists, Clinical Pharmacists, Dispensary Technicians  
**Role Required:** `pharmacist` / `admin`  
**Version:** 1.0.0 (Production Candidate)  

---

## 1. PHARMACY SUBSYSTEM OVERVIEW

The SmartMedChart Pharmacy module bridges physician orders and nursing bedside administration. It guarantees that medications dispensed to inpatient wards are authenticated, batch-tracked, and deducted from inventory in real time.

Key capabilities:
- **Formulary Catalogue Management:** Generic and brand medications, dosage strengths, and reorder levels.
- **Stock Batch Tracking:** Expiry dates, lot numbers, and supplier receipt transactions.
- **Prescription Dispense Queue:** Inpatient orders awaiting pharmacist review and verification.
- **Inventory Audit Trail:** Complete ledger of stock adjustments, receipts, and ward dispensations.

---

## 2. NAVIGATING TO PHARMACY MANAGEMENT

1. Log in with your pharmacist credentials at `/login`.
2. Pharmacists are redirected directly to **Pharmacy Management** (`/admin/pharmacy`).
3. The interface provides two primary operational tabs:
   - **Prescription Orders (Dispense Queue)**
   - **Formulary & Stock Inventory**

---

## 3. INVENTORY & BATCH MANAGEMENT

### 3.1 Adding a New Formulary Item
1. Select the **Inventory** tab and click **Add New Medication**.
2. Complete the drug profile:
   - **Medication Name:** Standard generic name (e.g., `Amoxicillin`, `Atorvastatin`, `Furosemide`).
   - **Strength:** Unit concentration (e.g., `500 mg`, `20 mg`, `10 mg/ml`).
   - **Form:** `Tablet`, `Capsule`, `Vial`, `Syrup`, `Ampoule`, `Ointment`.
   - **Current Stock:** Initial physical count received.
   - **Reorder Level:** Minimum stock threshold before low-inventory alerts trigger (e.g., `50 units`).
3. Click **Save Formulary Item**.

### 3.2 Recording Stock Receipts (Batches)
1. Locate the medication in the inventory table.
2. Click **Add Stock**.
3. Enter:
   - **Quantity Received:** Number of units.
   - **Batch / Lot Number:** Manufacturer batch code (e.g., `LOT-2026-X88`).
   - **Expiration Date:** Date of expiration (`YYYY-MM-DD`).
4. Click **Confirm Receipt**. The system increases available stock and logs a transaction record in `stock_transactions`.

---

## 4. INPATIENT PRESCRIPTION DISPENSING WORKFLOW

1. Open the **Prescription Orders** queue.
2. All physician orders marked `PENDING_DISPENSE` are listed in order of priority.
3. Click **Review Order** on a prescription:
   - Verify the patient name and attending physician.
   - Inspect the prescribed dose, frequency, route, and duration.
   - Review patient allergies to confirm there are no contraindications.
4. **Batch Allocation:**
   - The system presents available batches with earliest expiration dates (FIFO policy).
   - Confirm the selected batch number and quantity to dispense.
5. Click **Authorize & Dispense**.
6. **System Actions:**
   - Prescription status transitions to `DISPENSED`.
   - Pharmacy inventory is atomically decremented by the dispensed quantity.
   - Medication schedule statuses transition from `PENDING` to `UPCOMING`.
   - Bedside nurses can now view and administer the scheduled doses.
