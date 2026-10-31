from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.routes import chat
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.doctor import router as doctor_router
from app.routes.nurse import router as nurse_router
from app.routes.qr import router as qr_router
from app.routes.nurse_qr import router as nurse_qr_router
from app.routes.ai import router as ai_router
from app.routes.dashboard import router as dashboard_router
from app.routes.safety import router as safety_router
from app.routes.hospital import router as hospital_router
from app.routes.allergies import router as allergies_router
from app.routes.carematch import router as carematch_router

app = FastAPI(
    title="SmartMedChart API",
    description="Hospital Medication Management System",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://172.20.10.2:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Register API routers
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

# =========================================================
# Root
# =========================================================

@app.get("/")
def root():
    return {
        "message": "SmartMedChart API is running",
        "status": "healthy",
    }


# =========================================================
# Database health
# =========================================================

from app.mongo_client import ping_mongodb

@app.get("/health/database")
def database_health():
    try:
        ping_mongodb()
        return {
            "database": "MongoDB",
            "status": "connected",
        }
    except Exception as error:
        return {
            "database": "MongoDB",
            "status": "disconnected",
            "error": str(error),
        }
from app.routes.mongodb_status import router as mongodb_status_router

app.include_router(mongodb_status_router)