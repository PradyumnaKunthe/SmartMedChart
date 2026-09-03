from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.safety import (
    MedicationSafetyResponse,
)
from app.security import require_permission

from app.services.medication_safety_service import (
    check_medication_safety,
)


router = APIRouter(
    prefix="/api/safety",
    tags=["Medication Safety"],
)


@router.get(
    "/medications/{schedule_id}",
    response_model=MedicationSafetyResponse,
)
def check_medication(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Run medication safety checks for a schedule.
    """

    try:
        result = check_medication_safety(
            db=db,
            schedule_id=schedule_id,
        )

        return result

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error