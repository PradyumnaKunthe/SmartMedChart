import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import BaseModel, Field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AIPrediction,
    MedicationSchedule,
    User,
)
from app.security import require_permission

from ai.feature_service import (
    build_medication_features,
)

from ai.prediction_service import (
    predict_medication_risk,
)


router = APIRouter(
    prefix="/api/ai",
    tags=["AI"],
)


# =========================================================
# Manual AI Prediction Request
# =========================================================

class AIPredictionRequest(BaseModel):
    ward: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    medicine: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    frequency: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    frequency_per_day: int = Field(
        ...,
        gt=0,
        le=10,
    )

    scheduled_hour: int = Field(
        ...,
        ge=0,
        le=23,
    )

    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
    )

    is_stat: int = Field(
        ...,
        ge=0,
        le=1,
    )

    active_medications: int = Field(
        ...,
        ge=0,
    )

    previous_delays: int = Field(
        ...,
        ge=0,
    )

    previous_missed: int = Field(
        ...,
        ge=0,
    )

    ward_delay_rate: float = Field(
        ...,
        ge=0.0,
        le=1.0,
    )

    nurse_workload: int = Field(
        ...,
        ge=0,
    )


# =========================================================
# Manual Prediction Endpoint
# =========================================================

@router.post("/predict")
def predict_ai(
    request: AIPredictionRequest,
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Generate AI-based medication delay
    and missed-dose predictions from
    manually supplied feature values.
    """

    medication_data = request.model_dump()

    result = predict_medication_risk(
        medication_data
    )

    return {
        "message": (
            "AI prediction generated successfully."
        ),
        "prediction": result,
    }


# =========================================================
# Schedule-Based AI Prediction Endpoint
# =========================================================

@router.post(
    "/schedules/{schedule_id}/predict"
)
def predict_schedule_risk(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Generate AI delay and missed-dose predictions
    directly from a real SmartMedChart medication
    schedule and save the prediction in the database.
    """

    # -----------------------------------------------------
    # 1. Find medication schedule
    # -----------------------------------------------------

    schedule = db.scalar(
        select(MedicationSchedule).where(
            MedicationSchedule.id == schedule_id
        )
    )

    if schedule is None:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    # -----------------------------------------------------
    # 2. Build AI features from real database
    # -----------------------------------------------------

    try:
        features = build_medication_features(
            db=db,
            schedule_id=schedule_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    # -----------------------------------------------------
    # 3. Generate AI prediction
    # -----------------------------------------------------

    prediction = predict_medication_risk(
        features
    )

    # -----------------------------------------------------
    # 4. Create database record
    # -----------------------------------------------------

    ai_record = AIPrediction(
        medication_schedule_id=schedule_id,

        delay_probability=prediction[
            "delay_probability"
        ],

        delay_risk_level=prediction[
            "delay_risk_level"
        ],

        delay_prediction=prediction[
            "delay_prediction"
        ],

        missed_probability=prediction[
            "missed_probability"
        ],

        missed_risk_level=prediction[
            "missed_risk_level"
        ],

        missed_prediction=prediction[
            "missed_prediction"
        ],

        delay_reasons=json.dumps(
            prediction[
                "delay_reasons"
            ]
        ),

        missed_reasons=json.dumps(
            prediction[
                "missed_reasons"
            ]
        ),

        model_version=(
            "delay-rf-v1 / missed-rf-v1"
        ),
    )

    db.add(ai_record)
    db.commit()
    db.refresh(ai_record)

    # -----------------------------------------------------
    # 5. Return prediction
    # -----------------------------------------------------

    return {
        "message": (
            "AI prediction generated and saved successfully."
        ),

        "prediction_id": ai_record.id,

        "schedule_id": schedule_id,

        "features": features,

        "prediction": prediction,
    }
@router.get("/predictions")
def get_ai_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return recent AI medication-risk predictions.
    """

    predictions = db.scalars(
        select(AIPrediction)
        .order_by(
            AIPrediction.created_at.desc()
        )
    ).all()

    return {
        "count": len(predictions),
        "predictions": [
            {
                "id": prediction.id,
                "medication_schedule_id": (
                    prediction.medication_schedule_id
                ),
                "delay_probability": (
                    prediction.delay_probability
                ),
                "delay_risk_percent": round(
                    prediction.delay_probability * 100,
                    2,
                ),
                "delay_risk_level": (
                    prediction.delay_risk_level
                ),
                "delay_prediction": (
                    prediction.delay_prediction
                ),
                "missed_probability": (
                    prediction.missed_probability
                ),
                "missed_risk_percent": round(
                    prediction.missed_probability * 100,
                    2,
                ),
                "missed_risk_level": (
                    prediction.missed_risk_level
                ),
                "missed_prediction": (
                    prediction.missed_prediction
                ),
                "delay_reasons": json.loads(
                    prediction.delay_reasons
                )
                if prediction.delay_reasons
                else [],
                "missed_reasons": json.loads(
                    prediction.missed_reasons
                )
                if prediction.missed_reasons
                else [],
                "model_version": (
                    prediction.model_version
                ),
                "created_at": prediction.created_at,
            }
            for prediction in predictions
        ],
    }
# =========================================================
# High-Risk AI Predictions
# =========================================================

@router.get("/predictions/high-risk")
def get_high_risk_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return AI predictions where either delay risk
    or missed-dose risk is HIGH.
    """

    predictions = db.scalars(
        select(AIPrediction)
        .where(
            (AIPrediction.delay_risk_level == "HIGH")
            | (
                AIPrediction.missed_risk_level
                == "HIGH"
            )
        )
        .order_by(
            AIPrediction.created_at.desc()
        )
    ).all()

    return {
        "count": len(predictions),
        "predictions": [
            {
                "id": prediction.id,

                "medication_schedule_id": (
                    prediction.medication_schedule_id
                ),

                "delay_probability": (
                    prediction.delay_probability
                ),

                "delay_risk_percent": round(
                    prediction.delay_probability * 100,
                    2,
                ),

                "delay_risk_level": (
                    prediction.delay_risk_level
                ),

                "delay_prediction": (
                    prediction.delay_prediction
                ),

                "missed_probability": (
                    prediction.missed_probability
                ),

                "missed_risk_percent": round(
                    prediction.missed_probability * 100,
                    2,
                ),

                "missed_risk_level": (
                    prediction.missed_risk_level
                ),

                "missed_prediction": (
                    prediction.missed_prediction
                ),

                "delay_reasons": json.loads(
                    prediction.delay_reasons
                )
                if prediction.delay_reasons
                else [],

                "missed_reasons": json.loads(
                    prediction.missed_reasons
                )
                if prediction.missed_reasons
                else [],

                "model_version": (
                    prediction.model_version
                ),

                "created_at": prediction.created_at,
            }
            for prediction in predictions
        ],
    }