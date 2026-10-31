from datetime import datetime
import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import BaseModel, Field

from app.mongo_client import mongo_db, next_mongo_id
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
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
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
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Generate AI delay and missed-dose predictions
    directly from a real SmartMedChart medication
    schedule and save the prediction in MongoDB.
    """

    # -----------------------------------------------------
    # 1. Find medication schedule in MongoDB
    # -----------------------------------------------------

    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": schedule_id},
            {"id": schedule_id},
        ]
    })

    if schedule is None:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    actual_schedule_id = schedule.get("id", schedule.get("_id"))

    # -----------------------------------------------------
    # 2. Build AI features from MongoDB
    # -----------------------------------------------------

    try:
        features = build_medication_features(
            schedule_id=actual_schedule_id,
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
    # 4. Create MongoDB record
    # -----------------------------------------------------

    new_id = next_mongo_id("ai_predictions")
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    ai_record = {
        "_id": new_id,
        "id": new_id,
        "medication_schedule_id": actual_schedule_id,
        "delay_probability": prediction["delay_probability"],
        "delay_risk_level": prediction["delay_risk_level"],
        "delay_prediction": prediction["delay_prediction"],
        "missed_probability": prediction["missed_probability"],
        "missed_risk_level": prediction["missed_risk_level"],
        "missed_prediction": prediction["missed_prediction"],
        "delay_reasons": json.dumps(prediction["delay_reasons"]),
        "missed_reasons": json.dumps(prediction["missed_reasons"]),
        "model_version": "delay-rf-v1 / missed-rf-v1",
        "created_at": now_str,
    }

    mongo_db.ai_predictions.insert_one(ai_record)

    # -----------------------------------------------------
    # 5. Return prediction
    # -----------------------------------------------------

    return {
        "message": (
            "AI prediction generated and saved successfully."
        ),
        "prediction_id": new_id,
        "schedule_id": actual_schedule_id,
        "features": features,
        "prediction": prediction,
    }


# =========================================================
# Recent AI Predictions
# =========================================================

@router.get("/predictions")
def get_ai_predictions(
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return recent AI medication-risk predictions from MongoDB.
    """

    predictions = list(
        mongo_db.ai_predictions.find().sort("created_at", -1)
    )

    results = []
    for prediction in predictions:
        delay_reasons = prediction.get("delay_reasons", "[]")
        if isinstance(delay_reasons, str):
            try:
                delay_reasons = json.loads(delay_reasons)
            except Exception:
                delay_reasons = []

        missed_reasons = prediction.get("missed_reasons", "[]")
        if isinstance(missed_reasons, str):
            try:
                missed_reasons = json.loads(missed_reasons)
            except Exception:
                missed_reasons = []

        delay_prob = float(prediction.get("delay_probability") or 0.0)
        missed_prob = float(prediction.get("missed_probability") or 0.0)

        results.append({
            "id": prediction.get("id", prediction.get("_id")),
            "medication_schedule_id": prediction.get("medication_schedule_id"),
            "delay_probability": delay_prob,
            "delay_risk_percent": round(delay_prob * 100, 2),
            "delay_risk_level": prediction.get("delay_risk_level"),
            "delay_prediction": prediction.get("delay_prediction"),
            "missed_probability": missed_prob,
            "missed_risk_percent": round(missed_prob * 100, 2),
            "missed_risk_level": prediction.get("missed_risk_level"),
            "missed_prediction": prediction.get("missed_prediction"),
            "delay_reasons": delay_reasons,
            "missed_reasons": missed_reasons,
            "model_version": prediction.get("model_version"),
            "created_at": prediction.get("created_at"),
        })

    return {
        "count": len(results),
        "predictions": results,
    }


# =========================================================
# High-Risk AI Predictions
# =========================================================

@router.get("/predictions/high-risk")
def get_high_risk_predictions(
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return AI predictions where either delay risk
    or missed-dose risk is HIGH from MongoDB.
    """

    query = {
        "$or": [
            {"delay_risk_level": "HIGH"},
            {"missed_risk_level": "HIGH"},
        ]
    }

    predictions = list(
        mongo_db.ai_predictions.find(query).sort("created_at", -1)
    )

    results = []
    for prediction in predictions:
        delay_reasons = prediction.get("delay_reasons", "[]")
        if isinstance(delay_reasons, str):
            try:
                delay_reasons = json.loads(delay_reasons)
            except Exception:
                delay_reasons = []

        missed_reasons = prediction.get("missed_reasons", "[]")
        if isinstance(missed_reasons, str):
            try:
                missed_reasons = json.loads(missed_reasons)
            except Exception:
                missed_reasons = []

        delay_prob = float(prediction.get("delay_probability") or 0.0)
        missed_prob = float(prediction.get("missed_probability") or 0.0)

        results.append({
            "id": prediction.get("id", prediction.get("_id")),
            "medication_schedule_id": prediction.get("medication_schedule_id"),
            "delay_probability": delay_prob,
            "delay_risk_percent": round(delay_prob * 100, 2),
            "delay_risk_level": prediction.get("delay_risk_level"),
            "delay_prediction": prediction.get("delay_prediction"),
            "missed_probability": missed_prob,
            "missed_risk_percent": round(missed_prob * 100, 2),
            "missed_risk_level": prediction.get("missed_risk_level"),
            "missed_prediction": prediction.get("missed_prediction"),
            "delay_reasons": delay_reasons,
            "missed_reasons": missed_reasons,
            "model_version": prediction.get("model_version"),
            "created_at": prediction.get("created_at"),
        })

    return {
        "count": len(results),
        "predictions": results,
    }