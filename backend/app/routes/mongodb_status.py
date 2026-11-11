from fastapi import APIRouter, Depends, HTTPException, status

from app.mongo_client import (
    MONGODB_DATABASE,
    ping_mongodb,
)
from app.security import require_permission

router = APIRouter(tags=["MongoDB"])


@router.get("/api/mongodb-status")
def mongodb_status(
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    """
    Authenticated administrative database diagnostic probe.
    Requires MANAGE_SYSTEM permission to prevent anonymous reconnaissance.
    """
    try:
        ping_mongodb()
        return {
            "status": "connected",
            "database": MONGODB_DATABASE,
        }

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is unavailable",
        ) from error
