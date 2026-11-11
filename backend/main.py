import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment variables
ENV_FILE = Path(__file__).resolve().parent / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

from app.middleware import security_and_size_middleware
from app.mongo_client import init_security_indexes, ping_mongodb
from app.services.notification_service import (
    init_notification_indexes,
    process_due_notifications,
)
from app.routes import chat
from app.routes.admin import router as admin_router
from app.routes.ai import router as ai_router
from app.routes.allergies import router as allergies_router
from app.routes.auth import router as auth_router
from app.routes.carematch import router as carematch_router
from app.routes.dashboard import router as dashboard_router
from app.routes.doctor import router as doctor_router
from app.routes.hospital import router as hospital_router
from app.routes.mongodb_status import router as mongodb_status_router
from app.routes.monitoring import router as monitoring_router
from app.routes.nurse import router as nurse_router
from app.routes.nurse_qr import router as nurse_qr_router
from app.routes.pharmacy import router as pharmacy_router
from app.routes.qr import router as qr_router
from app.routes.safety import router as safety_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager.
    Initializes database indexes and runs the periodic 5-minute pre-dose
    notification evaluator unless running in dedicated worker mode.
    """
    init_notification_indexes()
    init_security_indexes()

    enable_embedded_worker = (
        os.getenv("ENABLE_EMBEDDED_SCHEDULER", "true").lower() in ("true", "1", "yes")
    )
    stop_event = asyncio.Event()
    worker_task = None

    if enable_embedded_worker:
        async def notification_worker():
            while not stop_event.is_set():
                try:
                    process_due_notifications()
                except Exception:
                    pass
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=15.0)
                except asyncio.TimeoutError:
                    pass

        worker_task = asyncio.create_task(notification_worker())

    yield

    if enable_embedded_worker and worker_task:
        stop_event.set()
        try:
            await asyncio.wait_for(worker_task, timeout=2.0)
        except Exception:
            pass


is_production = (
    os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
    or bool(os.getenv("RENDER"))
)
enable_api_docs = (
    os.getenv("ENABLE_API_DOCS", "false" if is_production else "true").lower()
    in ("true", "1", "yes")
)

docs_url = "/docs" if enable_api_docs else None
redoc_url = "/redoc" if enable_api_docs else None
openapi_url = "/openapi.json" if enable_api_docs else None

app = FastAPI(
    title="SmartMedChart API",
    description="Hospital Medication Management System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)


# =========================================================
# Security Headers & Request Body Size Middleware
# =========================================================

app.middleware("http")(security_and_size_middleware)


# =========================================================
# CORS Configuration
# =========================================================

def get_cors_origins() -> list[str]:
    """
    Build allowed CORS origins for local development and production.
    Supports comma-separated domain list in CORS_ORIGINS environment variable.
    """
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://localhost",
    ]

    custom_origins = os.getenv("CORS_ORIGINS", "")
    if custom_origins:
        for entry in custom_origins.split(","):
            cleaned = entry.strip().rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)

    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Register API Routers
# =========================================================

app.include_router(auth_router)
app.include_router(doctor_router)
app.include_router(nurse_router)
app.include_router(qr_router)
app.include_router(nurse_qr_router)
app.include_router(ai_router)
app.include_router(dashboard_router)
app.include_router(safety_router)
app.include_router(hospital_router)
app.include_router(chat.router)
app.include_router(admin_router)
app.include_router(allergies_router)
app.include_router(carematch_router)
app.include_router(monitoring_router)
app.include_router(pharmacy_router)
app.include_router(mongodb_status_router)


# =========================================================
# Root Endpoint
# =========================================================

@app.get("/")
def root():
    return {
        "message": "SmartMedChart API is running",
        "status": "healthy",
        "version": "1.0.0",
    }


# =========================================================
# Health & Readiness Probes (Cloud-native / Render / Docker)
# =========================================================

@app.get("/healthz")
def liveness_check():
    """Basic liveness check confirming web server is responding."""
    return {
        "status": "ok",
        "app": "SmartMedChart",
        "version": "1.0.0",
    }


@app.get("/readyz")
def readiness_check():
    """
    Readiness check validating that database connectivity is responsive.
    Returns 200 if connected, 503 if disconnected.
    Safe for public cloud monitoring without leaking internal credentials.
    """
    try:
        ping_mongodb()
        return {
            "status": "ready",
            "database": "connected",
        }
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
            },
        )


@app.get("/health/database")
def database_health():
    """Legacy database health probe preserved for backward compatibility."""
    try:
        ping_mongodb()
        return {
            "database": "MongoDB",
            "status": "connected",
        }
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "database": "MongoDB",
                "status": "disconnected",
            },
        )
