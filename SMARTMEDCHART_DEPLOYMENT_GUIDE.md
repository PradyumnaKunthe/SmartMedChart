# SMARTMEDCHART — PRODUCTION DEPLOYMENT & INFRASTRUCTURE GUIDE

**Application:** SmartMedChart  
**Deployment Target:** Cloud Native (Render Web Service + Render/Vercel Static Site + MongoDB Atlas)  
**Version:** 1.0.0 (Production Candidate)  
**Document Classification:** DevOps & Site Reliability Engineering (SRE) Specification  
**Last Updated:** November 11, 2026  

---

## 1. ARCHITECTURE TOPOLOGY & HOSTING MODEL

SmartMedChart is structured for resilient, low-latency hospital operations using modern cloud platforms:

```
[ Bedside Tablets / Desktop Browsers ]
                 │
                 ▼ HTTPS (TLS 1.3)
      [ Frontend Static Edge ] 
        (Render / Vercel CDN)
                 │
                 ▼ REST API / JSON (TLS 1.3)
    [ FastAPI Application Service ]
        (Render Web Service)
                 │
                 ▼ SCRAM-SHA-256 + TLS
   [ MongoDB Atlas Cloud Cluster ]
      (Primary + Secondary Replicas)
```

---

## 2. PRODUCTION ENVIRONMENT VARIABLES SPECIFICATION

### 2.1 Backend API Service (`backend/.env` or Render Dashboard)
| Variable Name | Type | Recommended Value / Format | Purpose |
|---|:---:|---|---|
| `ENVIRONMENT` | string | `production` | Enables production safeguards; disables interactive API docs unless requested. |
| `MONGODB_URI` | string | `mongodb+srv://<user>:<pwd>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority` | Atlas connection string. Masks credentials during log outputs. |
| `MONGODB_DATABASE` | string | `smartmedchart` | Name of the target MongoDB database. |
| `JWT_SECRET_KEY` | string | `64+ char random hex string` (e.g., `openssl rand -hex 32`) | Secret key used to sign and verify HMAC-SHA256 JWT tokens. |
| `JWT_ALGORITHM` | string | `HS256` | Token cryptographic algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `120` | JWT token validity window in minutes. |
| `CORS_ORIGINS` | string | `https://smartmedchart.vercel.app,https://smartmedchart.onrender.com` | Comma-separated list of allowed frontend origins. |
| `ENABLE_API_DOCS` | bool | `false` | Disables `/docs`, `/redoc`, and `/openapi.json` to prevent public schema disclosure. |
| `ENABLE_EMBEDDED_SCHEDULER` | bool | `true` | Runs background notification worker within FastAPI lifespan. |

### 2.2 Frontend Application (`frontend/.env` or Vercel Dashboard)
| Variable Name | Type | Value | Purpose |
|---|:---:|---|---|
| `VITE_API_BASE_URL` | string | `https://smartmedchart-api.onrender.com` | Target URL of the live FastAPI backend service. |

---

## 3. STEP-BY-STEP PRODUCTION DEPLOYMENT PROCEDURES

### 3.1 MongoDB Atlas Cluster Provisioning
1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create or select a Project (e.g., `SmartMedChart-Prod`).
3. Deploy an M0 Free Tier or M10 Dedicated Cluster in your regional cloud provider (e.g., AWS `us-east-1` or `eu-west-1`).
4. **Database Access:** Create an application user `smartmedchart_api` with `readWriteAnyDatabase` privileges.
5. **Network Access:** In the Atlas Network Access panel, add `0.0.0.0/0` (Allow Access from Anywhere) to permit dynamic Render container IP routing, or configure VPC peering if deploying to enterprise AWS.
6. Copy the connection string format: `mongodb+srv://smartmedchart_api:<PASSWORD>@<cluster>.mongodb.net/?retryWrites=true&w=majority`.

### 3.2 Backend Web Service Deployment (Render)
1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`PradyumnaKunthe/SmartMedChart`).
4. Configure service parameters:
   - **Name:** `smartmedchart-api`
   - **Region:** Closest to your MongoDB Atlas cluster (e.g., Oregon or Frankfurt).
   - **Branch:** `work/end-to-end-development` (or target release branch).
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Add Environment Variables:** Populate all variables outlined in Section 2.1 above.
6. **Health Check Path:** Set to `/healthz`.
7. Click **Deploy Web Service**.
8. Verify logs confirm:
   - `init_notification_indexes() OK`
   - `init_security_indexes() OK`
   - `Uvicorn running on http://0.0.0.0:10000`

### 3.3 Frontend Static Site Deployment (Vercel or Render Static Site)
1. In Vercel or Render, create a new Static Web App connected to the repository.
2. Configure build parameters:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://smartmedchart-api.onrender.com`
4. Deploy the site.

---

## 4. POST-DEPLOYMENT VERIFICATION & SMOKE TEST

Execute the following smoke tests against the live deployment URL:

```bash
# 1. Verify Liveness Probe
curl -i https://smartmedchart-api.onrender.com/healthz
# Expected: HTTP 200 OK {"status": "ok", "app": "SmartMedChart", "version": "1.0.0"}

# 2. Verify Database Readiness Probe
curl -i https://smartmedchart-api.onrender.com/readyz
# Expected: HTTP 200 OK {"status": "ready", "database": "connected"}

# 3. Verify Public API Docs are Disabled
curl -i https://smartmedchart-api.onrender.com/docs
# Expected: HTTP 404 Not Found

# 4. Verify MongoDB Status is Authenticated
curl -i https://smartmedchart-api.onrender.com/api/mongodb-status
# Expected: HTTP 401 Unauthorized

# 5. Verify CORS Rejection on Foreign Origin
curl -i -H "Origin: https://malicious-site.com" https://smartmedchart-api.onrender.com/
# Expected: No Access-Control-Allow-Origin header returned
```

---

## 5. DISASTER RECOVERY & BACKUP POLICIES

- **Automated Backups:** MongoDB Atlas Point-In-Time Restore (PITR) runs continuous oplog archiving and daily snapshots retained for 30 days.
- **Failover:** MongoDB Atlas provides automated 3-node replica set failover with $< 5$ second master re-election.
- **Rollback Procedure:** Render and Vercel support instant one-click rollbacks to the prior immutable build artifact.
