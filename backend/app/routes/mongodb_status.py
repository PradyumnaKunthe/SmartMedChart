from fastapi import APIRouter, HTTPException

from app.mongo_client import (
    MONGODB_DATABASE,
    ping_mongodb,
)

router = APIRouter(tags=["MongoDB"])


@router.get("/api/mongodb-status")
def mongodb_status():
    try:
        ping_mongodb()
        return {
            "status": "connected",
            "database": MONGODB_DATABASE,
        }

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is unavailable",
        ) from error