# SmartMedChart – Complete Free Deployment Guide
## Deploying on Render Free + Vercel Free + MongoDB Atlas M0 Free

> **Audience:** DevOps, Evaluators, College Project Demonstrators, and Developers.  
> **Cost:** $0.00 / month (100% Free Tiers).  
> **Goal:** A fully working cloud-hosted hospital medication and inpatient management demonstration with persistent MongoDB cloud storage and real API interactions.

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         Vercel Free Frontend             |
                      |          (React 18 + Vite)               |
                      |  https://smartmedchart.vercel.app       |
                      +--------------------+---------------------+
                                           |
                              HTTPS REST API Calls
                              (Bearer JWT Token)
                                           |
                                           v
                      +------------------------------------------+
                      |          Render Free Backend             |
                      |            (FastAPI / Uvicorn)           |
                      |  https://smartmedchart-api.onrender.com  |
                      |                                          |
                      |  [Embedded Medication Scheduler Loop]    |
                      +--------------------+---------------------+
                                           |
                                 TLS MongoDB Driver
                                 (dnspython + SRV)
                                           |
                                           v
                      +------------------------------------------+
                      |       MongoDB Atlas M0 Free Cluster      |
                      |          (Cloud MongoDB 7.0+)            |
                      |       DB: smartmedchart_production       |
                      +------------------------------------------+
```

---

## Demonstration Scope (College Demo Checklist)

Once deployed, your cloud-hosted demonstration will support the following live workflow with persistent storage:
1. **1 System Administrator** (`admin`): Logs into Admin Console, manages roles, creates clinical staff.
2. **1 Doctor** (`dr_sharma`): Logs in, views OPD queue, accesses patient chart, prescribes medications, orders inpatient admission.
3. **1 Nurse** (`nurse_priya`): Logs in, views assigned admitted patients, checks dose schedules, scans patient QR codes, records administrations.
4. **1 Receptionist** (`receptionist1`): Registers new patients; triggers CareMatch doctor recommendations.
5. **1 Inpatient Ward** ("General Ward A"): Configured under Hospital Management.
6. **1 Bed** ("Bed 101"): Assigned to admitted patient with real-time occupancy status.

---

## Phase 1: GitHub Branch Preparation

SmartMedChart development and deployment assets are prepared on the `work/end-to-end-development` branch.

1. Ensure all your deployment assets (`render.yaml`, `frontend/vercel.json`, `backend/init_mongodb_atlas.py`) are committed to your working branch:
   ```bash
   git status
   git branch
   # Confirms branch is: work/end-to-end-development
   ```

2. Push your working branch to your remote GitHub repository:
   ```bash
   git push origin work/end-to-end-development
   ```

> [!TIP]
> Keep your development work on `work/end-to-end-development`. When setting up Render and Vercel in the steps below, you will simply select `work/end-to-end-development` as the deployment branch.

---

## Phase 2: MongoDB Atlas Free Cluster Setup

MongoDB Atlas provides a 512 MB free tier (M0) that never expires and requires no credit card.

### Step 2.1: Create Free Cluster
1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Click **Create** or **Build a Database**.
3. Choose **M0 Free** (Shared).
4. Select a cloud provider and region closest to your users:
   - **AWS Singapore (`ap-southeast-1`)** or **AWS Frankfurt (`eu-central-1`)** or **AWS Oregon (`us-west-2`)**.
5. Set Cluster Name (e.g., `Cluster0` or `SmartMedChartCluster`).
6. Click **Create Deployment**.

### Step 2.2: Create Database User
1. Under the **Quickstart / Security** prompt (or from the left sidebar under **Security > Database Access**):
2. Click **Add New Database User**.
3. **Authentication Method:** Password.
4. **Username:** `smartmedchart_admin` (or your choice).
5. **Password:** Generate a secure, strong alphanumeric password (e.g., 24 characters).  
   > [!WARNING]
   > Avoid special characters like `@`, `:`, `/`, or `?` in the password because they require URL encoding in the connection URI. Use standard alphanumeric letters and digits.
6. **Database User Privileges:** Select **Read and write to any database** (or `Atlas admin`).
7. Click **Add User**.

### Step 2.3: Configure Secure Network Access
Render web services run in dynamic cloud containers and do not have static outbound IP addresses on the Free Tier.
1. In the left navigation, click **Security > Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (this enters `0.0.0.0/0`).
4. Set description: `Allow Render cloud instances`.
5. Click **Confirm**.

> [!NOTE]
> MongoDB Atlas requires authentication for every connection even when `0.0.0.0/0` is allowed. Your database is protected by your strong database user password and TLS encryption.

### Step 2.4: Obtain Connection String
1. Under **Deployments > Database**, find your cluster and click **Connect**.
2. Choose **Drivers** (Python / PyMongo).
3. Copy the SRV connection URI:
   ```
   mongodb+srv://smartmedchart_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Replace `<password>` with your actual database user password.

---

## Phase 3: Initialize MongoDB Atlas Database

SmartMedChart includes a dedicated initialization script (`backend/init_mongodb_atlas.py`) that safely seeds roles, permissions, indexes, and an initial administrator into MongoDB Atlas without needing manual JSON imports.

### Step 3.1: Dry Run Verification
From your local terminal, run the script in safe dry-run mode to verify connectivity to your Atlas cluster:
```bash
# In the backend directory:
cd backend

# Run safe dry-run (replace with your real Atlas connection string):
python init_mongodb_atlas.py --uri "mongodb+srv://smartmedchart_admin:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority" --db smartmedchart_production --dry-run
```
The script will output:
```
[*] Connecting to MongoDB: mongodb+srv://smartmedchart_admin:****@cluster0...
[*] Target database: smartmedchart_production
[OK] Successfully connected to MongoDB.

--- Auditing Roles ---
  [+] Role 'Doctor' needs creation.
  [+] Role 'Nurse' needs creation.
  [+] Role 'Pharmacist' needs creation.
  [+] Role 'Administrator' needs creation.
  [+] Role 'Receptionist' needs creation.
...
[NOTE] Dry-run completed. No database changes were committed.
```

### Step 3.2: Apply Initialization and Create Administrator
Execute the initialization with `--apply` and `--create-admin`:
```bash
python init_mongodb_atlas.py \
  --uri "mongodb+srv://smartmedchart_admin:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority" \
  --db smartmedchart_production \
  --apply \
  --seed-demo-catalog \
  --create-admin
```

1. Type `yes` when prompted to confirm the target database.
2. Enter Administrator username: `admin` (or press Enter).
3. Enter Administrator email: `admin@smartmedchart.org` (or press Enter).
4. Enter Administrator full name: `System Administrator` (or press Enter).
5. Enter a secure password (minimum 8 characters, e.g., `AdminPass2026!`).
6. The script creates:
   - 5 System Roles (Doctor, Nurse, Pharmacist, Administrator, Receptionist).
   - 18 Granular System Permissions.
   - 26 Role-Permission links.
   - 15 Performance and Uniqueness Indexes.
   - 5 Clean Demonstration Medicines (Paracetamol, Amoxicillin, Metformin, Atorvastatin, Omeprazole).
   - First Administrator user with Argon2id password hash.

---

## Phase 4: Render Free Backend Setup

Render hosts the FastAPI application using the official Python runtime and provides free SSL.

### Step 4.1: Create Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository (`PradyumnaKunthe/SmartMedChart`).
4. Configure the service settings:
   - **Name:** `smartmedchart-backend`
   - **Region:** **Singapore** (or Oregon / Frankfurt)
   - **Branch:** `work/end-to-end-development`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install --no-cache-dir -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`

### Step 4.2: Configure Render Environment Variables
Under the **Environment** tab of your Render service, add the following variables:

| Key | Example Value | Purpose |
|---|---|---|
| `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python runtime |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI |
| `MONGODB_DATABASE` | `smartmedchart_production` | Target production database name |
| `JWT_SECRET_KEY` | *(generate 64-char hex key)* | Secret key for signing session tokens |
| `JWT_ALGORITHM` | `HS256` | Token hashing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token expiration window |
| `ENVIRONMENT` | `production` | Enables production safeguards |
| `ENABLE_EMBEDDED_SCHEDULER` | `true` | Runs 15s notification evaluator inside web dyno |
| `NOTIFICATION_POLL_INTERVAL` | `15` | Pre-dose medication notification evaluation interval |
| `CORS_ORIGINS` | `http://localhost:5173` *(will update in Phase 6)* | Allowed frontend origins |

> [!TIP]
> Generate a strong 64-character JWT secret key locally in your terminal:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

### Step 4.3: Deploy and Obtain Backend URL
1. Click **Create Web Service**.
2. Render will build and launch your service.
3. Check the build logs:
   - Dependencies will install from `requirements.txt`.
   - Uvicorn will bind to port `$PORT`.
4. Once deployed, Render will display your service URL at the top of the dashboard:
   ```
   https://smartmedchart-backend.onrender.com
   ```
5. Test the health probe in your browser:
   - `https://smartmedchart-backend.onrender.com/readyz`  
     Expected response: `{"status": "ready", "database": "connected"}`

---

## Phase 5: Vercel Free Frontend Setup

Vercel hosts the React 18 + Vite frontend with global CDN edge caching and free SSL.

### Step 5.1: Import Project to Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New... > Project**.
3. Import your GitHub repository (`PradyumnaKunthe/SmartMedChart`).
4. In the project setup form:
   - **Project Name:** `smartmedchart` (or your choice)
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend`.
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

### Step 5.2: Configure Vercel Environment Variables
Under **Environment Variables**, add:

| Key | Value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `https://smartmedchart-backend.onrender.com` | Your live Render backend URL (NO trailing slash) |

> [!IMPORTANT]
> Do NOT append a trailing slash `/` to `VITE_API_BASE_URL`. Enter `https://smartmedchart-backend.onrender.com` exactly.

### Step 5.3: Deploy and Obtain Frontend URL
1. Click **Deploy**.
2. Vercel will install dependencies and compile Vite assets.
3. Once completed, Vercel will assign a production domain:
   ```
   https://smartmedchart.vercel.app
   ```
4. Verify that opening `https://smartmedchart.vercel.app/login` loads the login screen.

---

## Phase 6: Connect CORS (Render <-> Vercel)

Now that both your backend and frontend URLs are known, authorize your Vercel domain in Render:

1. Go back to your [Render Dashboard](https://dashboard.render.com).
2. Select your `smartmedchart-backend` service.
3. Go to **Environment**.
4. Update `CORS_ORIGINS` to include your Vercel domain:
   ```
   https://smartmedchart.vercel.app,http://localhost:5173
   ```
   *(If Vercel assigned a custom domain or preview URL, include it separated by commas).*
5. Click **Save Changes**. Render will automatically trigger a zero-downtime redeploy.

---

## Phase 7: Live College Demonstration Workflow

Test the complete end-to-end college demonstration workflow:

### Step 7.1: Administrator Login & Staff Creation
1. Navigate to `https://smartmedchart.vercel.app/login`.
2. Log in using your created admin credentials (`admin` / password).
3. Navigate to **Staff Assignments / Clinical Accounts** (`/admin/staff`).
4. Create the **Doctor** account:
   - Full Name: `Dr. Rajesh Sharma`
   - Username: `dr_sharma`
   - Email: `sharma@smartmedchart.org`
   - Password: `DoctorPassword123`
   - Role: `Doctor`
   - Click **Create Clinical Account**.
5. Create the **Nurse** account:
   - Full Name: `Nurse Priya Singh`
   - Username: `nurse_priya`
   - Email: `priya@smartmedchart.org`
   - Password: `NursePassword123`
   - Role: `Nurse`
   - Click **Create Clinical Account**.
6. Create the **Receptionist** account:
   - Full Name: `Hospital Receptionist`
   - Username: `receptionist1`
   - Email: `reception@smartmedchart.org`
   - Password: `ReceptionPassword123`
   - Role: `Receptionist`
   - Click **Create Clinical Account**.

### Step 7.2: Doctor Profile & CareMatch Configuration
1. Still logged in as Admin, navigate to **Doctor Profiles** (`/admin/doctor-profiles`).
2. Select `Dr. Rajesh Sharma`.
3. Check Qualifications: `MBBS`, `MD`.
4. Check Specializations: `Internal Medicine`, `Cardiology`.
5. Check Expertise & Keywords: `Hypertension`, `Chest Pain`, `General Medicine`.
6. Set OPD Hours (e.g., 09:00 - 17:00, Monday to Friday).
7. Click **Save Doctor Profile**.

### Step 7.3: Ward and Bed Setup
1. In the sidebar, navigate to **Hospital Management > Wards** (`/hospital/wards`).
2. Create Ward:
   - Ward Name: `General Ward A`
   - Ward Type: `General`
   - Floor: `1`
   - Capacity: `10`
   - Click **Save Ward**.
3. Create Bed:
   - Select `General Ward A`.
   - Bed Number: `Bed 101`
   - Bed Type: `Standard`
   - Click **Add Bed**.

### Step 7.4: Patient Registration & CareMatch (Receptionist)
1. Log out of Administrator and log in as `receptionist1`.
2. You will be redirected to the **Hospital Portal / Patient Registration** (`/hospital/register-patient`).
3. Fill in Patient Information:
   - First Name: `Aarav`
   - Last Name: `Patel`
   - Age: `45`, Gender: `Male`
   - Contact: `9876543210`
   - Chief Complaint: `Persistent chest pain and high blood pressure for 3 days`
4. Notice **CareMatch Doctor Recommendation**:
   - CareMatch analyzes the complaint and automatically recommends `Dr. Rajesh Sharma` (Score: 90%+ match for Cardiology/Hypertension).
5. Confirm registration and note the generated Patient ID (e.g., `PID-1001`).

### Step 7.5: Doctor Prescription, Inpatient Admission & Nurse Assignment
1. Log out of Receptionist and log in as `dr_sharma`.
2. You will be on the **Doctor Dashboard**. Select patient `Aarav Patel`.
3. Click **Create Prescription**.
4. Select Medicines:
   - Medicine: `Paracetamol 500mg` — Dose: `500mg`, Route: `Oral`, Frequency: `Twice Daily (BID)`, Duration: `5 days`.
   - Click **+ Add Another Medicine**.
   - Medicine: `Atorvastatin 20mg` — Dose: `20mg`, Route: `Oral`, Frequency: `Once Daily (OD)`, Duration: `14 days`.
5. Under **Inpatient Admission & Bed Assignment**:
   - Admit to Inpatient Ward: Select **YES**.
   - Ward: Select `General Ward A`.
   - Bed: Select `Bed 101`.
   - **ASSIGN NURSE:** Select `Nurse Priya Singh (nurse_priya)`.
6. Click **Authorize & Create Prescription**.
7. The patient is admitted, Bed 101 is marked Occupied, and Nurse Priya is assigned!

### Step 7.6: Nurse Administration & Dose Verification
1. Log out of Doctor and log in as `nurse_priya`.
2. The **Nurse Dashboard** immediately displays `Aarav Patel` under **Assigned Patients (Ward A / Bed 101)**.
3. Open Patient Chart:
   - Review active prescriptions and planned administration times.
4. Click **Record Administration / Verify QR**:
   - Scan patient wristband QR token (or perform bedside manual verification).
   - Confirm safety checklist (Right Patient, Right Drug, Right Dose, Right Route, Right Time).
   - Record dose given.
5. Dose status updates to **Given** with audit timestamp in persistent MongoDB.

---

## Free-Tier Constraints & Operational Notes

| Component | Free-Tier Characteristic | Impact & Mitigation |
|---|---|---|
| **Render Web Service** | Spins down (sleeps) after 15 minutes of user inactivity | First request after sleep takes 30-50 seconds (cold start). For college presentations, open `/readyz` 2 minutes before the demo to wake the server up. |
| **Notification Scheduler** | Runs inside web process lifespan | When Render web service sleeps, background notification checks pause. Notifications resume immediately when any user accesses the app. |
| **MongoDB Atlas M0** | 512 MB storage limit | Ample capacity for thousands of demo prescriptions, patients, and audit logs. |
| **Render Ephemeral Disk** | File uploads do not persist across restarts | SmartMedChart stores all medical charts, schedules, and clinical notes in MongoDB documents (not on disk). |

---

## Troubleshooting Common Deployment Issues

### 1. Backend Returns 503 on `/readyz`
- **Cause:** Backend cannot connect to MongoDB Atlas.
- **Fix:**
  1. Check MongoDB Atlas **Network Access** and ensure `0.0.0.0/0` is allowed.
  2. Check your `MONGODB_URI` password in Render environment variables for typos or unencoded special characters.
  3. Ensure `MONGODB_DATABASE=smartmedchart_production` is set.

### 2. Frontend Login Shows "Network Error"
- **Cause:** CORS restriction or wrong backend URL in Vercel.
- **Fix:**
  1. Verify `VITE_API_BASE_URL` in Vercel matches `https://smartmedchart-backend.onrender.com` without trailing slash.
  2. Verify Render's `CORS_ORIGINS` includes your live Vercel domain (`https://smartmedchart.vercel.app`).
  3. Check browser developer console (F12) for exact blocked CORS origin.

### 3. Blank White Screen After Deployment
- **Cause:** Direct route navigation or 404 on Vite SPA.
- **Fix:**
  Ensure `frontend/vercel.json` exists with the SPA catch-all rewrite:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

---

## How to Deploy Code Updates in the Future

When you push new changes to GitHub:
```bash
git push origin work/end-to-end-development
```
1. **Render** detects the push and automatically rebuilds and deploys the backend.
2. **Vercel** detects the push and automatically recompiles and deploys the frontend.
3. Your cloud database data remains completely safe and persistent in MongoDB Atlas.

