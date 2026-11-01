# SmartMedChart — Comprehensive Deployment Readiness Audit

**Audit Date:** November 1, 2026  
**Auditor:** DevOps & Full-Stack Architect  
**Repository:** `PradyumnaKunthe/SmartMedChart`  
**Target Branch:** `main`  
**Target Infrastructure:**  
- **Cloud Database:** MongoDB Atlas + Windows MongoDB Compass  
- **Backend Service:** Render (FastAPI + Python + Uvicorn)  
- **Frontend Hosting:** Vercel (React 19 + Vite 8 + Tailwind CSS 4)  
- **Client Devices:** iPhone Safari (HTTPS camera scanning), Android Chrome, Desktop Chrome  
- **Local Dev / Test:** Docker Compose (Isolated `smartmedchart_docker_test` container)

---

## 1. Executive Summary

A comprehensive architectural and configuration audit was conducted across the SmartMedChart codebase to evaluate its readiness for manual deployment to MongoDB Atlas, Render, and Vercel. 

The application architecture is modern, robust, and cleanly split between a FastAPI backend and a React (Vite) single-page application. Core business features—including CareMatch, multi-medicine prescriptions, bedside QR verification, and 5-minute pre-dose nurse reminders—are implemented with persistent MongoDB schemas.

However, several critical deployment blockers and configuration gaps were identified:
1. **No Root `.gitignore`:** Only subfolder `.gitignore` files exist. Root-level untracked files risk accidental commits.
2. **Hardcoded CORS Origins:** FastAPI CORS middleware permits only localhost URLs; production Vercel frontend requests would be rejected by CORS preflight.
3. **No Environment-Driven Frontend API Base URL:** Axios instance uses `baseURL: ""` which relies on Vite's local dev server proxy. On Vercel, requests to `/api/*` would return 404 without `VITE_API_BASE_URL`.
4. **Missing SPA Rewrites for Vercel:** No `vercel.json` is present. Direct navigations or browser refreshes on routes like `/doctor/dashboard` or `/admin/dashboard` would return 404 from Vercel's static router.
5. **Missing Render Blueprint (`render.yaml`):** No automated or declarative Render service specification exists.
6. **Missing Environment Template Files (`.env.example`):** Neither `backend/.env.example` nor `frontend/.env.example` existed to guide safe manual platform setup.
7. **Hardcoded Fallback Secret in `compose.yaml`:** Docker Compose contained a hardcoded JWT secret in its default variable expansion.
8. **Health Check Probes:** `/health/database` returned raw error strings (potential information disclosure) instead of standard cloud-native `/healthz` and `/readyz` endpoints.
9. **Dead Code / Zero-Byte Skeletons:** 29 zero-byte placeholder files and several unreferenced `.backup` files were discovered across the repository.

---

## 2. Architecture Discovery & Inventory

| Component | Target / Discovered Value | Status |
|---|---|---|
| **Frontend Root** | `frontend/` | Verified |
| **Frontend Framework** | React 19.2 + Vite 8.0 + Tailwind CSS 4.1 | Verified |
| **Frontend Output Dir** | `frontend/dist/` | Verified |
| **Backend Root** | `backend/` | Verified |
| **Backend Entry Point** | `backend/main.py` (`app = FastAPI(...)`) | Verified |
| **Python Runtime** | Local: 3.14.5 / Docker: 3.12-slim / Recommended Render: 3.11.9 or 3.12.x | Verified |
| **Node.js Runtime** | Node.js v24.16.0 / npm 11.13.0 (Docker builder uses Node 20-alpine) | Verified |
| **MongoDB Client** | PyMongo 4.19.0 with `dnspython 2.9.0` (SRV support confirmed) | Verified |
| **Current DB URI Var** | `MONGODB_URI` (defaults to `mongodb://127.0.0.1:27017`) | Verified |
| **Current DB Name Var** | `MONGODB_DATABASE` (defaults to `smartmedchart`) | Verified |
| **JWT Configuration** | `JWT_SECRET_KEY`, `JWT_ALGORITHM=HS256`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30` | Verified |
| **Password Hashing** | `pwdlib` with Argon2 recommended algorithm | Verified |
| **AI Models** | `delay_model_random_forest.pkl`, `missed_model_random_forest.pkl` (`scikit-learn` / `joblib`) | Verified |
| **QR Scanner** | `html5-qrcode` with multi-camera cascade and manual fallback | Needs Safari polish |
| **Notification Scheduler** | 5-minute pre-dose worker; runs in FastAPI lifespan loop (15s polling) | Needs standalone entrypoint |

---

## 3. Detailed Audit Findings & Remediation Plan

### 3.1. Database & MongoDB Atlas Connectivity
- **Findings:** 
  - `backend/app/mongo_client.py` reads `MONGODB_URI` and `MONGODB_DATABASE` via `os.getenv`.
  - PyMongo requires `dnspython` for `mongodb+srv://` connection strings (MongoDB Atlas clusters). `dnspython==2.9.0` is present in `backend/requirements.txt`.
  - Current client connects immediately upon module import with `serverSelectionTimeoutMS=5000`. If Atlas is unreachable or IP is not whitelisted, startup will block for 5 seconds before raising `ServerSelectionTimeoutError`.
  - Logging of connection strings must ensure passwords are not printed in logs.
- **Remediation:**
  - Standardize environment loading in `backend/app/mongo_client.py`.
  - Add connection string URI sanitization helper before printing diagnostics.
  - Document strict Atlas Network Access whitelist requirements (e.g. Render outbound IPs or `0.0.0.0/0` with strong password).

### 3.2. Backend (FastAPI on Render)
- **Findings:**
  - Entry point is `main:app` (when running from within `backend/`).
  - Render dynamically sets `$PORT`. The start command must be:
    `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Health check path on Render should point to `/readyz` which validates application and database readiness without leaking sensitive exception messages.
  - `backend/main.py` currently has only `/` and `/health/database`.
- **Remediation:**
  - Add `/healthz` (liveness: returns 200 `{"status": "ok", "app": "SmartMedChart"}`).
  - Add `/readyz` (readiness: executes `ping_mongodb()`; returns 200 if connected, 503 if disconnected, with clean generic messages).
  - Create `render.yaml` declaring the web service and optional worker service.
  - Create `backend/.env.example` with exact variable placeholders.

### 3.3. Frontend (React + Vite on Vercel)
- **Findings:**
  - `frontend/src/services/api.js` has `baseURL: ""` hardcoded. On Vercel, requests to `/api/auth/login` would fail with 404 because Vercel does not know where the FastAPI backend lives.
  - Direct navigation to `/login`, `/doctor/dashboard`, etc., results in 404 on refresh unless Vercel rewrites all paths to `/index.html`.
  - `frontend/package.json` build script is `vite build`, producing output in `frontend/dist`.
- **Remediation:**
  - Update `frontend/src/services/api.js` to read `import.meta.env.VITE_API_BASE_URL || ""`, trimming trailing slashes.
  - Create `frontend/vercel.json` with SPA catch-all rewrites:
    ```json
    {
      "rewrites": [
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```
  - Create `frontend/.env.example` with `VITE_API_BASE_URL=https://smartmedchart-backend.onrender.com`.

### 3.4. CORS & Cross-Origin Communication
- **Findings:**
  - In `backend/main.py`, `CORSMiddleware` currently hardcodes:
    `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://172.20.10.2:5173"]`
  - Because `allow_credentials=True`, wildcard `*` cannot be used.
  - If the Vercel domain (e.g., `https://smartmedchart.vercel.app`) is not included in `allow_origins`, browser preflight OPTIONS requests will be blocked.
- **Remediation:**
  - Read `CORS_ORIGINS` from environment variable (comma-separated).
  - Merge with default local development origins so local development never breaks.
  - Strip trailing slashes and clean whitespace from origin strings.

### 3.5. iPhone Safari & Bedside QR Camera Scanning
- **Findings:**
  - `QRCodeScanner.jsx` uses `Html5Qrcode` with fallback cascading:
    1. Preferred camera ID
    2. `facingMode: "environment"` (rear camera)
    3. `facingMode: "user"` (front camera)
    4. First enumerated camera ID
  - iOS Safari requires `<video>` tags to include `playsinline` and `webkit-playsinline` attributes to prevent full-screen playback takeover.
  - Camera tracks must be explicitly stopped on unmount and error recovery so that the green camera indicator on iOS does not remain stuck on.
  - Real camera access on mobile devices strictly requires a secure context (`https://` or `localhost`).
  - Fallback manual QR token entry exists and works in `PatientVerification.jsx` and `DoctorOnRound.jsx`.
- **Remediation:**
  - Add explicit track cleanup (`track.stop()`) on video elements in `stopScanner()`.
  - Ensure `playsinline` is applied to viewport video elements.
  - Document HTTPS requirement and step-by-step physical device testing procedures.

### 3.6. Background Worker & Medication Reminder Architecture
- **Findings:**
  - SmartMedChart delivers medication notifications 5 minutes before scheduled administration time.
  - `backend/app/services/notification_service.py` persists records in `medication_notifications` in MongoDB with a unique compound index on `(medication_schedule_id, notification_type)` to guarantee idempotency.
  - In `backend/main.py`, an asyncio task in the FastAPI `lifespan` runs `process_due_notifications()` every 15 seconds.
  - In a single-instance deployment (such as Render Free Tier), the lifespan scheduler runs safely without incurring costs for a second background service.
  - For scaled environments (multiple web processes), running the scheduler in every web dyno could produce redundant DB queries. While duplicate notifications are prevented by the unique compound index, running a dedicated background worker is cleaner for multi-instance architectures.
- **Remediation:**
  - Provide a standalone worker entrypoint (`backend/worker.py`) that can be executed as a dedicated Render Background Worker (`python worker.py`).
  - Add an environment toggle `ENABLE_EMBEDDED_SCHEDULER` (default `true`) in `backend/main.py`. If set to `false`, the web process skips running the background loop, delegating entirely to the dedicated worker.

### 3.7. Security, Secrets & Git Tracking
- **Findings:**
  - No root `.gitignore` was present. Subfolder `.gitignore` files were protecting `backend/.venv` and `frontend/node_modules`, but root files were vulnerable.
  - `backend/.env` is NOT tracked in git (confirmed with `git ls-files`).
  - `compose.yaml` had a fallback default `JWT_SECRET_KEY=hwzkU1LnhcWUr9b7glAsQZceNeNEG6vTiR4kOviQDxE`.
  - Several SQLite backup files (`*.db`), migration scripts, and backup source files (`*.backup`) remain in `backend/`.
- **Remediation:**
  - Create comprehensive root `.gitignore`.
  - Replace the hardcoded JWT secret in `compose.yaml` with a required environment reference.
  - Verify `.dockerignore` files prevent local databases, virtual environments, and `.env` files from leaking into Docker images.

---

## 4. Phase-by-Phase Execution Checklist

- [x] **Phase 1:** Complete Deployment Audit (`SMARTMEDCHART_DEPLOYMENT_AUDIT.md`)
- [ ] **Phase 2:** MongoDB Atlas & Compass Configuration (`backend/app/mongo_client.py`)
- [ ] **Phase 3:** Render Backend Readiness (`backend/main.py`, `backend/worker.py`, `render.yaml`, `backend/.env.example`)
- [ ] **Phase 4:** Vercel Frontend Readiness (`frontend/src/services/api.js`, `frontend/vercel.json`, `frontend/.env.example`)
- [ ] **Phase 5:** CORS & Cross-Origin Connectivity (`backend/main.py`)
- [ ] **Phase 6:** iPhone QR Camera Safari Hardening (`frontend/src/components/qr/QRCodeScanner.jsx`)
- [ ] **Phase 7:** Docker Compose & Container Verification (`compose.yaml`, `.dockerignore`)
- [ ] **Phase 8:** Security Audit & Root `.gitignore` (`.gitignore`)
- [ ] **Phase 9:** Safe Cleanup Audit & Dead Code Removal (`SMARTMEDCHART_DEPLOYMENT_CLEANUP_AUDIT.md`)
- [ ] **Phase 10:** Beginner-Friendly Manual Deployment Guide (`SMARTMEDCHART_MANUAL_DEPLOYMENT_GUIDE.md`)
- [ ] **Phase 11:** Local Builds, E2E Tests, Docker Config Check & Final Readiness Report (`SMARTMEDCHART_DEPLOYMENT_READINESS_REPORT.md`)

