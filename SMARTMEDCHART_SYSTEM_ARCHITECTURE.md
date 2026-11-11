# SMARTMEDCHART — SYSTEM ARCHITECTURE SPECIFICATION

**Application:** SmartMedChart (Inpatient Clinical & Medication Administration System)  
**Version:** 1.0.0 (Production Candidate)  
**Document Classification:** Architectural Specification & Engineering Reference  
**Last Updated:** November 11, 2026  

---

## 1. ARCHITECTURAL OVERVIEW & PRINCIPLES

SmartMedChart is an enterprise electronic medical chart and Barcode Medication Administration (BCMA) platform built to prevent medication errors, streamline clinical workflows across multi-disciplinary hospital staff, and protect patient Protected Health Information (PHI).

The system follows a decoupled three-tier architecture:
1. **Presentation Tier (Frontend):** Modern Single Page Application (SPA) developed with React 18, Vite, and Tailwind CSS. It communicates asynchronously with the API gateway via Axios with automated JWT injection, interceptor-level authorization handling, responsive UI layouts, and integrated camera-based QR code decoding.
2. **Application & Logic Tier (Backend):** High-throughput, asynchronous RESTful API developed with Python FastAPI and Pydantic v2. It provides role-based and permission-based authorization, sliding-window rate limiting, cryptographic token management, real-time clinical monitoring algorithms, and automated background dose alerting.
3. **Data & Persistence Tier (Database):** Document-oriented MongoDB Atlas cluster (with local replica set fallback). Collections leverage custom integer sequence generators for human-readable IDs, composite uniqueness indexes, compound query indexes, and TTL-based automated document eviction.

```mermaid
flowchart TD
    subgraph ClientTier ["Client Tier (Browser & Bedside Devices)"]
        UI_Desktop["Desktop Workstations (Admin, Doctor, Pharmacy)"]
        UI_Mobile["Bedside Tablets & Mobile COW (Nurse Scanner)"]
    end

    subgraph SecurityBoundary ["Security & Gateway Layer"]
        CORS["CORS Filter (Whitelisted Origins)"]
        SecHeaders["Security Headers Middleware (CSP, HSTS, X-Frame)"]
        RateLimiter["Distributed Rate Limiter (Mongo Atomic Updates)"]
        AuthMiddleware["JWT Bearer Authentication & JTI Revocation"]
        RBAC["Permission & Role Authorization Engine"]
    end

    subgraph AppTier ["Application Services Tier (FastAPI)"]
        AuthSvc["Auth & Session Service"]
        ClinicalSvc["Doctor & Prescription Service"]
        NurseSvc["Nurse BCMA & Countdown Service"]
        PharmaSvc["Pharmacy & Dispensing Service"]
        MonitorSvc["Medication Monitoring & Safety Service"]
        CareMatchSvc["CareMatch Appointment Service"]
        AISvc["Clinical Risk AI Service"]
        BgWorker["Background Notification Worker (asyncio)"]
    end

    subgraph DataTier ["Data Persistence Tier (MongoDB Atlas)"]
        DB_Users[("users & roles")]
        DB_Patients[("patients & encounters")]
        DB_Rx[("prescriptions & items")]
        DB_Schedules[("medication_schedules")]
        DB_Admin[("medication_administrations")]
        DB_Inventory[("pharmacy_items & stock")]
        DB_Tokens[("revoked_tokens (TTL)")]
        DB_Limits[("login_rate_limits (TTL)")]
    end

    UI_Desktop --> CORS
    UI_Mobile --> CORS
    CORS --> SecHeaders
    SecHeaders --> RateLimiter
    RateLimiter --> AuthMiddleware
    AuthMiddleware --> RBAC

    RBAC --> AuthSvc
    RBAC --> ClinicalSvc
    RBAC --> NurseSvc
    RBAC --> PharmaSvc
    RBAC --> MonitorSvc
    RBAC --> CareMatchSvc
    RBAC --> AISvc

    BgWorker -.-> DB_Schedules
    BgWorker -.-> DB_Patients

    AuthSvc --> DB_Users
    AuthSvc --> DB_Tokens
    RateLimiter --> DB_Limits
    ClinicalSvc --> DB_Patients
    ClinicalSvc --> DB_Rx
    NurseSvc --> DB_Schedules
    NurseSvc --> DB_Admin
    PharmaSvc --> DB_Inventory
    PharmaSvc --> DB_Rx
    MonitorSvc --> DB_Schedules
    CareMatchSvc --> DB_Patients
```

---

## 2. COMPONENT ARCHITECTURE & SUBSYSTEMS

### 2.1 Presentation Layer (Frontend)
- **Framework & Tooling:** React 18.2+, Vite 8.2+ build toolchain, Tailwind CSS for utility-first styling.
- **Routing & Navigation:** `react-router-dom` v6 with hierarchical route guards:
  - `ProtectedRoute`: Verifies active session token; redirects unauthenticated visitors to `/login`.
  - `RoleRoute`: Evaluates role membership (`admin`, `doctor`, `nurse`, `hospital`, `pharmacist`); prevents horizontal privilege escalation.
  - `HomeRedirect`: Automatically routes authenticated users to their primary dashboard upon loading `/`.
- **State & Context Management:**
  - `AuthContext`: Centralizes authentication state, active user profile, login, logout, and token revocation dispatch.
  - Token Synchronization: Stored in browser `localStorage` and attached via Axios request interceptors (`Authorization: Bearer <token>`).
- **Hardware Integration:**
  - `html5-qrcode` & modern MediaDevices API for camera-based wristband barcode/QR scanning at the bedside.
  - HTML5 Web Audio API synthesizers for acoustic verification feedback during scanning and critical dose alerts.

### 2.2 Application Layer (FastAPI Backend)
- **Framework:** FastAPI with Uvicorn ASGI server.
- **Data Validation & Serialization:** Pydantic v2 schemas enforcing strict typing, field boundaries, and input sanitization (`extra="forbid"` on sensitive updates).
- **Lifespan Manager:**
  - `init_security_indexes()`: Ensures critical uniqueness and TTL indexes exist prior to accepting traffic.
  - `init_notification_indexes()`: Sets up compound schedule indexes for alerting.
  - `notification_worker()`: Asynchronous background coroutine executing every 15 seconds to evaluate 5-minute pre-dose medication alerts.
- **Middleware Pipeline:**
  1. `security_and_size_middleware`: Rejects payloads exceeding 10MB (`HTTP 413 Payload Too Large`) and injects OWASP recommended HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'`).
  2. `CORSMiddleware`: Restricts cross-origin requests to configured domains (`http://localhost:5173`, custom domains from `CORS_ORIGINS`).

---

## 3. AUTHENTICATION & TOKEN LIFECYCLE

SmartMedChart utilizes JSON Web Tokens (JWT) using the `HS256` signature algorithm. 

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Clinical Staff
    participant UI as React Frontend
    participant API as FastAPI Backend
    participant RL as Rate Limiter (Mongo)
    participant DB as MongoDB Atlas

    User->>UI: Enter username & password
    UI->>API: POST /api/auth/login {username, password}
    API->>RL: Check rate limit (10 attempts / 10 min window)
    alt Rate Limit Exceeded
        RL-->>API: Limit exceeded
        API-->>UI: HTTP 429 Too Many Requests
    else Allowed
        API->>DB: Query user by username
        API->>API: Verify password hash (pwdlib Argon2/Bcrypt)
        API->>API: Generate unique jti (UUID4) & JWT Token
        API-->>UI: HTTP 200 OK {access_token, token_type: "bearer", user}
        UI->>UI: Store access_token in localStorage
        UI->>UI: Route to role-specific dashboard
    end

    Note over UI, API: Authenticated API Requests
    UI->>API: GET /api/nurse/medications (Header: Bearer JWT)
    API->>DB: Check revoked_tokens for jti
    alt Token Revoked
        API-->>UI: HTTP 401 Unauthorized (Token has been revoked)
        UI->>UI: Clear local session & redirect to /login
    else Token Valid
        API->>API: Verify role & permission scopes
        API-->>UI: HTTP 200 OK (Scoped Clinical Payload)
    end

    Note over User, UI: User Logout Workflow
    User->>UI: Click Logout button
    UI->>API: POST /api/auth/logout (Header: Bearer JWT)
    API->>DB: Insert jti into revoked_tokens with expires_at TTL
    API-->>UI: HTTP 200 OK {message: "Successfully logged out"}
    UI->>UI: Purge token and state from localStorage
    UI->>User: Redirect to Login Screen
```

---

## 4. BEDSIDE BCMA WORKFLOW & PROXIMITY VERIFICATION

The Barcode Medication Administration (BCMA) workflow enforces physical proximity between the nurse and patient to prevent wrong-patient errors:

```mermaid
sequenceDiagram
    autonumber
    actor Nurse as Bedside Nurse
    participant UI as Nurse QR Scanner (UI)
    participant API as Nurse API (/api/nurse-qr)
    participant DB as MongoDB Atlas

    Nurse->>UI: Scan Patient Wristband QR Code
    UI->>API: POST /api/nurse-qr/verify-patient {qr_token}
    API->>DB: Lookup patient by qr_token
    alt Invalid QR Token
        API-->>UI: HTTP 404 Not Found (Invalid Patient QR)
    else Valid QR Token
        API->>DB: Record qr_verifications (nurse_id, patient_id, timestamp)
        API-->>UI: HTTP 200 OK {verified: true, patient_details, active_window: "15m"}
        UI->>UI: Activate 15-minute Bedside Verification Session
    end

    Nurse->>UI: Select Scheduled Dose & physically administer
    UI->>API: POST /api/nurse/medications/{id}/administer
    API->>DB: Check active qr_verification within 15 minutes
    alt Bedside Session Expired (> 15 min)
        API-->>UI: HTTP 403 Forbidden (Bedside QR scan expired)
    else Proximity Verified
        API->>API: compute_monitoring_status(scheduled_time, now)
        API->>DB: Insert medication_administrations (Unique Index uq_med_admin_schedule_id)
        API->>DB: Update medication_schedules status to GIVEN
        API-->>UI: HTTP 200 OK {status: "GIVEN", administration_status: "ON_TIME"}
        UI->>Nurse: Visual & Audible Confirmation
    end
```

---

## 5. CLINICAL MEDICATION LIFECYCLE

```mermaid
stateDiagram-v2
    [*] --> PRESCRIBED: Doctor creates Prescription
    PRESCRIBED --> DISPENSED: Pharmacy dispenses stock
    PRESCRIBED --> CANCELLED: Doctor discontinues Rx

    state DISPENSED {
        [*] --> UPCOMING: Schedules generated
        UPCOMING --> DUE: Within Grace Period (-15 min)
        DUE --> OVERDUE: Grace period passed (+30 min)
        OVERDUE --> MISSED: > 120 minutes past scheduled time
    }

    DUE --> GIVEN: Nurse administers at bedside (On-time)
    OVERDUE --> GIVEN: Nurse administers at bedside (Late)
    DUE --> HELD: Nurse holds dose with clinical rationale
    OVERDUE --> HELD: Nurse holds dose with clinical rationale
    MISSED --> HELD: Nurse documents missed dose

    HELD --> [*]
    GIVEN --> [*]
    CANCELLED --> [*]
```

---

## 6. DATA PERSISTENCE & DEPLOYMENT TOPOLOGY

SmartMedChart is architected for zero-trust cloud hosting:
- **Web App Delivery:** Static site build deployed to Vercel or Render Static Sites with SSL termination and global CDN edge caching.
- **API Microservice:** Python 3.13 ASGI application deployed as a managed Render Web Service with automated health probes (`/healthz` for liveness, `/readyz` for database connectivity readiness).
- **Persistence:** MongoDB Atlas Replica Set running MongoDB 7.0+ with encrypted TLS in-flight connections, SCRAM-SHA-256 credentials, and automated daily snapshots.
