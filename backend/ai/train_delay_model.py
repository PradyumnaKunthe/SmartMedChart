from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = (
    BASE_DIR
    / "data"
    / "synthetic_medication_history.csv"
)

MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

MODEL_FILE = (
    MODEL_DIR / "delay_model_logistic.pkl"
)


def main() -> None:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    target = "delayed"

    features = [
        "ward",
        "medicine",
        "frequency",
        "frequency_per_day",
        "scheduled_hour",
        "day_of_week",
        "is_stat",
        "active_medications",
        "previous_delays",
        "previous_missed",
        "ward_delay_rate",
        "nurse_workload",
    ]

    X = df[features]
    y = df[target]

    categorical_features = [
        "ward",
        "medicine",
        "frequency",
    ]

    numeric_features = [
        "frequency_per_day",
        "scheduled_hour",
        "day_of_week",
        "is_stat",
        "active_medications",
        "previous_delays",
        "previous_missed",
        "ward_delay_rate",
        "nurse_workload",
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore"
                ),
                categorical_features,
            ),
            (
                "numeric",
                StandardScaler(),
                numeric_features,
            ),
        ]
    )

    pipeline = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor,
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )

    X_train, X_test, y_train, y_test = (
        train_test_split(
            X,
            y,
            test_size=0.20,
            random_state=42,
            stratify=y,
        )
    )

    pipeline.fit(
        X_train,
        y_train,
    )

    predictions = pipeline.predict(X_test)

    probabilities = pipeline.predict_proba(
        X_test
    )[:, 1]

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    roc_auc = roc_auc_score(
        y_test,
        probabilities,
    )

    print("=" * 60)
    print("SMARTMEDCHART DELAY MODEL")
    print("=" * 60)

    print(f"\nTraining samples: {len(X_train)}")
    print(f"Testing samples:  {len(X_test)}")

    print(
        f"\nAccuracy: {accuracy:.4f}"
    )

    print(
        f"ROC-AUC:  {roc_auc:.4f}"
    )

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
        )
    )

    print("Confusion Matrix:")
    print(
        confusion_matrix(
            y_test,
            predictions,
        )
    )

    joblib.dump(
        pipeline,
        MODEL_FILE,
    )

    print(
        f"\nModel saved to:\n{MODEL_FILE}"
    )


if __name__ == "__main__":
    main()