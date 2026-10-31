from pathlib import Path

import joblib
import pandas as pd
from .explanation_service import (
    explain_delay_risk,
    explain_missed_risk,
)

BASE_DIR = Path(__file__).resolve().parent

DELAY_MODEL_PATH = (
    BASE_DIR / "models" / "delay_model_random_forest.pkl"
)

MISSED_MODEL_PATH = (
    BASE_DIR / "models" / "missed_model_random_forest.pkl"
)

DELAY_THRESHOLD = 0.45
MISSED_THRESHOLD = 0.40


def get_risk_level(probability: float) -> str:
    if probability < 0.30:
        return "LOW"

    if probability < 0.60:
        return "MEDIUM"

    return "HIGH"


def load_models():
    if not DELAY_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Delay model not found: {DELAY_MODEL_PATH}"
        )

    if not MISSED_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missed model not found: {MISSED_MODEL_PATH}"
        )

    delay_model = joblib.load(
        DELAY_MODEL_PATH
    )

    missed_model = joblib.load(
        MISSED_MODEL_PATH
    )

    return delay_model, missed_model


_delay_model = None
_missed_model = None


def get_models():
    global _delay_model, _missed_model
    if _delay_model is None or _missed_model is None:
        _delay_model, _missed_model = load_models()
    return _delay_model, _missed_model


def predict_medication_risk(
    medication_data: dict,
) -> dict:
    """
    Predict delay and missed-dose risk and
    provide human-readable explanations.
    """

    delay_model, missed_model = get_models()

    input_data = pd.DataFrame(
        [medication_data]
    )

    delay_probability = float(
        delay_model.predict_proba(
            input_data
        )[0][1]
    )

    missed_probability = float(
        missed_model.predict_proba(
            input_data
        )[0][1]
    )

    delay_risk_level = get_risk_level(
        delay_probability
    )

    missed_risk_level = get_risk_level(
        missed_probability
    )

    delay_prediction = (
        "LIKELY_DELAYED"
        if delay_probability >= DELAY_THRESHOLD
        else "LIKELY_ON_TIME"
    )

    missed_prediction = (
        "LIKELY_MISSED"
        if missed_probability >= MISSED_THRESHOLD
        else "LIKELY_GIVEN"
    )

    delay_reasons = explain_delay_risk(
        medication_data
    )

    missed_reasons = explain_missed_risk(
        medication_data
    )

    return {
        "delay_probability": round(
            delay_probability,
            4,
        ),
        "delay_risk_percent": round(
            delay_probability * 100,
            2,
        ),
        "delay_risk_level": delay_risk_level,
        "delay_prediction": delay_prediction,
        "delay_reasons": delay_reasons,

        "missed_probability": round(
            missed_probability,
            4,
        ),
        "missed_risk_percent": round(
            missed_probability * 100,
            2,
        ),
        "missed_risk_level": missed_risk_level,
        "missed_prediction": missed_prediction,
        "missed_reasons": missed_reasons,
    }