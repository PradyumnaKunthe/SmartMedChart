from pathlib import Path

import pandas as pd


DATA_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "synthetic_medication_history.csv"
)


def main() -> None:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    print("=" * 60)
    print("SMARTMEDCHART AI DATASET VALIDATION")
    print("=" * 60)

    print(f"\nRows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    print("\nColumns:")
    for column in df.columns:
        print(f"  - {column}")

    print("\nMissing values:")
    missing = df.isnull().sum()

    for column, count in missing.items():
        print(f"  {column}: {count}")

    print("\nDelayed distribution:")
    print(df["delayed"].value_counts())
    print(
        "Delayed rate:",
        round(df["delayed"].mean() * 100, 2),
        "%",
    )

    print("\nMissed distribution:")
    print(df["missed"].value_counts())
    print(
        "Missed rate:",
        round(df["missed"].mean() * 100, 2),
        "%",
    )

    print("\nWard distribution:")
    print(df["ward"].value_counts())

    print("\nFrequency distribution:")
    print(df["frequency"].value_counts())

    print("\nSTAT distribution:")
    print(df["is_stat"].value_counts())

    print("\nNumeric feature summary:")
    print(
        df[
            [
                "scheduled_hour",
                "active_medications",
                "previous_delays",
                "previous_missed",
                "ward_delay_rate",
                "nurse_workload",
            ]
        ].describe()
    )

    print("\nDuplicate rows:")
    print(df.duplicated().sum())

    print("\nFirst 5 rows:")
    print(df.head().to_string(index=False))

    print("\nValidation complete.")


if __name__ == "__main__":
    main()