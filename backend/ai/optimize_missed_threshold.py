from pathlib import Path

import joblib
import pandas as pd

from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
)
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parent

DATA_FILE = (
    BASE_DIR
    / "data"
    / "synthetic_medication_history.csv"
)

MODEL_FILE = (
    BASE_DIR
    / "models"
    / "missed_model_random_forest.pkl"
)


def main() -> None:
    df = pd.read_csv(DATA_FILE)

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
    y = df["missed"]

    _, X_test, _, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    model = joblib.load(MODEL_FILE)

    probabilities = model.predict_proba(X_test)[:, 1]

    print("=" * 60)
    print("SMARTMEDCHART MISSED-DOSE THRESHOLD ANALYSIS")
    print("=" * 60)

    print("\nThreshold | Precision | Recall | F1")
    print("-" * 45)

    results = []

    for threshold in [
        0.20,
        0.25,
        0.30,
        0.35,
        0.40,
        0.45,
        0.50,
        0.55,
        0.60,
    ]:
        predictions = (
            probabilities >= threshold
        ).astype(int)

        precision = precision_score(
            y_test,
            predictions,
            zero_division=0,
        )

        recall = recall_score(
            y_test,
            predictions,
            zero_division=0,
        )

        f1 = f1_score(
            y_test,
            predictions,
            zero_division=0,
        )

        results.append(
            {
                "threshold": threshold,
                "precision": precision,
                "recall": recall,
                "f1": f1,
            }
        )

        print(
            f"{threshold:8.2f} | "
            f"{precision:9.3f} | "
            f"{recall:6.3f} | "
            f"{f1:5.3f}"
        )

    best = max(
        results,
        key=lambda row: row["f1"],
    )

    print("\nBest threshold by F1:")
    print(
        f"Threshold: {best['threshold']:.2f}"
    )
    print(
        f"Precision: {best['precision']:.3f}"
    )
    print(
        f"Recall:    {best['recall']:.3f}"
    )
    print(
        f"F1:        {best['f1']:.3f}"
    )


if __name__ == "__main__":
    main()