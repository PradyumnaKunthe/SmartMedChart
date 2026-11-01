# SmartMedChart — Complete Manual Deployment Guide

A step-by-step, beginner-friendly operational guide to manually deploy SmartMedChart to **MongoDB Atlas**, **Render**, and **Vercel**, with camera testing on **iPhone Safari** and database administration via **MongoDB Compass**.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Vercel (React Frontend)   |
                      | https://<your-app>.vercel.app |
                      +--------------+--------------+
                                     |
               HTTPS API Calls (JWT) | CORS Allowed
                                     v
                      +-----------------------------+
                      |    Render (FastAPI Web)     |
                      | https://<backend>.onrender.com |
                      +--------------+--------------+
                                     |
                 TLS / SRV (Port 27017)
                                     v
                      +-----------------------------+
                      |   MongoDB Atlas (Cloud DB)  |
                      |   Cluster0 (M0 / Free Tier) |
                      +-----------------------------+
                                     ^
                         TLS 27017   |
                      +--------------+--------------+
                      | MongoDB Compass (Windows)   |
                      | Local Diagnostic Management |
                      +-----------------------------+
```

---

## SECTION A — GitHub Preparation

Before connecting Render or Vercel, push your deployment-ready changes to your GitHub repository.

### 1. Verify Clean Working Tree & Secrets Exclusion
Open your terminal in the `SmartMedChart` root directory and inspect git status:
```powershell
git status
```
Verify that:
- `.env` files are **NOT** staged or untracked.
- Local SQLite `.db` files and `mongodb_backup*/` are **NOT** staged.
- The new deployment files are visible:
  - `render.yaml`
  - `frontend/vercel.json`
  - `backend/.env.example`
  - `frontend/.env.example`
  - `.gitignore`
  - `compose.yaml`

### 2. Stage and Commit Changes
Run the following commands to stage and commit your prepared deployment files:
```powershell
git add .
git commit -m "feat(deployment): configure Render, Vercel, MongoDB Atlas, and iOS camera scanning"
```

### 3. Push to GitHub `main` Branch
```powershell
git push origin main
```
Confirm in your GitHub web browser at `https://github.com/PradyumnaKunthe/SmartMedChart` that the latest commit is live on branch `main`.

---

## SECTION B — MongoDB Atlas Setup & Compass Connection

### 1. Create MongoDB Atlas Account & Cluster
1. Navigate to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Click **Create** or **Build a Database**.
3. Choose the **M0 Free Tier** (Shared).
4. Select a cloud provider and region close to you (e.g., AWS / `us-east-1` or `eu-central-1` or `ap-south-1`).
5. Name your cluster (e.g., `SmartMedChartCluster`) and click **Create Deployment**.

### 2. Create a Database User
1. Under **Security** in the left sidebar, click **Database Access**.
2. Click **Add New Database User**.
3. Choose **Password** Authentication Method:
   - **Username:** `smartmedchart_app`
   - **Password:** Click *Autogenerate Secure Password* (copy this immediately into your password manager).
4. Under **Database User Privileges**, select **Read and write to any database** (or restrict to `smartmedchart_production`).
5. Click **Add User**.

### 3. Configure Network Access (IP Whitelist)
1. Under **Security**, click **Network Access**.
2. Click **Add IP Address**.
3. To allow Render servers (which use dynamic outbound IPs on the free tier) and your local computer:
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Add description: `Render backend and admin IP`.
4. Click **Confirm**. (MongoDB Atlas enforces strict database-user password authentication over TLS).

### 4. Obtain the Atlas Connection String
1. In the **Databases** view, click **Connect** next to your cluster.
2. Select **Drivers** (Python 3.12 or later).
3. Copy the SRV connection string:
   ```
   mongodb+srv://smartmedchart_app:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your database user password.

### 5. Connect MongoDB Compass from Windows
1. Open **MongoDB Compass** on your Windows PC.
2. Click **New Connection**.
3. Paste the Atlas connection string with your password.
4. Click **Save & Connect**.
5. Save this connection as `SmartMedChart Cloud (Atlas)`.
6. Notice that your existing local connection `mongodb://127.0.0.1:27017` remains separate and unaffected.

### 6. Initializing Production Database
1. In Compass, click **Create Database**:
   - **Database Name:** `smartmedchart_production`
   - **Collection Name:** `users`
2. SmartMedChart will automatically create collections and indexes upon first backend startup and seed execution.

---

## SECTION C — Render Backend Deployment

### 1. Create Web Service on Render
1. Navigate to [dashboard.render.com](https://dashboard.render.com) and sign in.
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect `PradyumnaKunthe/SmartMedChart`.
5. Fill in the service configuration:
   - **Name:** `smartmedchart-backend`
   - **Region:** `Oregon (US West)` (or closest to your Atlas cluster)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install --no-cache-dir -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan Type:** `Free`

### 2. Enter Backend Environment Variables
In the Render setup page under **Environment Variables**, click **Add Environment Variable** for each:

| Key | Value / Example | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python runtime |
| `MONGODB_URI` | `mongodb+srv://smartmedchart_app:PASSWORD@cluster0...` | Your Atlas connection string |
| `MONGODB_DATABASE` | `smartmedchart_production` | Production database name |
| `JWT_SECRET_KEY` | Generate via `openssl rand -hex 32` | 64-character secret key |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Session lifetime |
| `ENVIRONMENT` | `production` | Production mode |
| `ENABLE_EMBEDDED_SCHEDULER` | `true` | Runs 5-min reminders in web instance |
| `CORS_ORIGINS` | Temporary: `http://localhost:5173` | (Will add Vercel URL in Section E) |

### 3. Configure Health Check Path
Under **Advanced Settings**:
- **Health Check Path:** `/readyz`

### 4. Deploy and Verify
1. Click **Create Web Service**.
2. Watch the deployment logs:
   - Dependencies will install via `pip`.
   - Uvicorn will bind to `0.0.0.0:$PORT`.
   - `/readyz` probe will return `200 OK` once connected to Atlas.
3. Once live, note your backend URL:  
   `https://smartmedchart-backend.onrender.com`
4. Test in your browser:  
   Visit `https://smartmedchart-backend.onrender.com/readyz` -> should return `{"status": "ready", "database": "connected"}`.

---

## SECTION D — Vercel Frontend Deployment

### 1. Import Repository on Vercel
1. Navigate to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Select `PradyumnaKunthe/SmartMedChart`.

### 2. Configure Project Settings
- **Project Name:** `smartmedchart`
- **Framework Preset:** `Vite`
- **Root Directory:** Click **Edit** and choose `frontend`.

### 3. Build & Output Settings
Verify the defaults match:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 4. Enter Frontend Environment Variables
Expand **Environment Variables** and add:

| Key | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://smartmedchart-backend.onrender.com` | Your deployed Render backend URL |

*(Ensure there is NO trailing slash in the URL).*

### 5. Deploy
1. Click **Deploy**.
2. Vercel will install dependencies and execute `npm run build`.
3. Thanks to `frontend/vercel.json`, all SPA routes (`/doctor/dashboard`, `/login`, etc.) are pre-configured to route to `/index.html`.
4. Copy your live Vercel domain:  
   `https://smartmedchart.vercel.app` (or custom subdomain).

---

## SECTION E — Connect Render and Vercel (CORS Integration)

Now that you have your live Vercel URL, authorize it in the Render backend:

1. Open your **Render Dashboard** -> `smartmedchart-backend`.
2. Click **Environment**.
3. Edit `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://smartmedchart.vercel.app,http://localhost:5173
   ```
4. Click **Save Changes**. Render will automatically trigger a zero-downtime redeploy.
5. Once redeployed, open `https://smartmedchart.vercel.app` in your browser.
6. Open browser DevTools (`F12`) -> **Network** tab.
7. Try navigating to `/login` and observe API requests: they should succeed with status `200` without any CORS errors.

---

## SECTION F — Real Device Testing (iPhone Safari & Mobile Camera)

Bedside QR scanning requires a physical device with a camera and a secure HTTPS context.

### 1. iPhone Safari Prerequisites
- Web cameras are **only** accessible over HTTPS in iOS Safari (or `localhost`). Vercel automatically provides a valid SSL certificate.
- When prompted: `“smartmedchart.vercel.app” Would Like to Access the Camera`, tap **Allow**.

### 2. Test Step-by-Step

#### A. Patient Wristband Verification (Nurse)
1. On iPhone Safari, sign in as a Nurse (`nurse_priya` / `NursePass123`).
2. Navigate to **QR Verification** or click **Verify Patient QR**.
3. Tap **Open Camera Scanner**:
   - The scanner viewport activates with inline video (`playsinline`).
   - The camera cascade automatically selects the rear/environment lens.
   - Point the camera at a patient wristband QR or badge QR.
   - Reticle pulses; green checkmark appears on successful scan.
   - Identity, patient code, and ward assignment load instantly.
4. Close scanner -> verify the green camera indicator in iOS status bar disappears immediately (explicit track release).

#### B. Doctor On-Round Verification
1. Sign in as Doctor (`dr_ankush` / `DoctorPass123`).
2. Navigate to **Doctor On Round**.
3. Scan bedside QR to pull up patient round roster and clinical trajectory charts.

#### C. Negative / Safety Validation
1. **Wrong Patient QR:** Scan Patient B’s wristband while verifying a dose scheduled for Patient A.  
   *Expected:* The UI rejects the scan with an alert: `Scanned patient ID does not match expected patient. Verification aborted for patient safety.`
2. **Camera Denial:** Tap address bar (`aA` icon) -> **Website Settings** -> set Camera to **Deny** -> tap Retry.  
   *Expected:* Friendly notice explaining how to re-enable camera in Safari settings, plus fallback manual QR token input field.

---

## SECTION G — End-to-End Clinical Lifecycle Smoke Test

Perform this complete clinical walkthrough on your deployed instance:

| Step | User Role | Action | Expected Result |
|---|---|---|---|
| **1. Receptionist Intake** | `receptionist` / `ReceptionPass123` | Register new patient (Name, Age, Gender, Complaint). | Patient created in `OPD` status. No bed allocated. |
| **2. CareMatch AI** | `receptionist` or `hospital` | Click CareMatch on registered patient. | Symptoms analyzed, suitable department & specialist recommended. |
| **3. Doctor Consultation** | `dr_ankush` / `DoctorPass123` | Open Patient Profile -> Click **Write New Prescription**. | Prescription form opens. |
| **4. Multi-Drug Prescription** | `dr_ankush` | Add Medicine 1 (Paracetamol 500mg) + click **+ ADD ANOTHER MEDICINE** -> Add Medicine 2 (Amoxicillin 250mg). | Both drugs appear with independent schedules. |
| **5. Ward & Bed Allocation** | `dr_ankush` | Select ICU or General Ward -> Select unoccupied bed (e.g. GW-01 / Bed 2). | Ward bed status dynamically updates. |
| **6. Authorize Order** | `dr_ankush` | Click **AUTHORIZE & TRANSMIT PRESCRIPTION**. | Patient status switches to `INPATIENT`; bed marked `OCCUPIED`. |
| **7. Pharmacy Stock Check** | `admin` / `AdminPass123` | Open **Pharmacy Management** -> Stock Overview. | Dispensed medicines reflect deduction in batch inventory. |
| **8. 5-Min Nurse Reminder** | `nurse_priya` / `NursePass123` | View Nurse Dashboard 5 minutes before scheduled dose. | Automated pre-dose reminder notification appears for assigned nurse. |
| **9. Bedside QR Administration** | `nurse_priya` | Scan wristband -> verify drug -> click **Confirm Administration**. | Dose recorded with nurse timestamp. |
| **10. Doctor Ward Rounds** | `dr_ankush` | Open **Doctor On-Round** -> Record recovery score (e.g. 85/100). | Patient recovery graph plots improvement trajectory. |
| **11. Discharge Patient** | `dr_ankush` or `admin` | Discharge patient from Patient Profile. | Bed is freed immediately (`AVAILABLE`). Patient lifecycle becomes `DISCHARGED`. |
| **12. Visibility Isolation** | `receptionist` & `admin` | Check Receptionist patient list vs Admin Discharged list. | Discharged patient is hidden from active lists; visible ONLY in Admin -> Discharged Patients. |

---

## SECTION H — Troubleshooting & Diagnostics

### 1. Backend 503 "database disconnected" on Render
- **Cause:** MongoDB Atlas IP whitelist is blocking Render, or password in `MONGODB_URI` contains unencoded special characters.
- **Fix:** In Atlas Network Access, ensure `0.0.0.0/0` is allowed. If your password has `@` or `:`, URL-encode them (`%40`, `%3A`).

### 2. Frontend 404 on Page Refresh on Vercel
- **Cause:** Missing `vercel.json` rewrite rule.
- **Fix:** Ensure `frontend/vercel.json` exists in repo with rewrite to `/index.html` and redeploy.

### 3. CORS Error in Browser Console
- **Cause:** Vercel URL has not been added to Render `CORS_ORIGINS`.
- **Fix:** Add `https://<your-app>.vercel.app` (no trailing slash) to `CORS_ORIGINS` in Render Environment and save.

### 4. iPhone Safari "Camera Not Allowed"
- **Cause:** Permission previously blocked or non-HTTPS URL.
- **Fix:** Ensure URL begins with `https://`. In Safari, tap `aA` in address bar -> **Website Settings** -> **Camera** -> select **Allow**.

