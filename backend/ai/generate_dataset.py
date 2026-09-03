from pathlib import Path

import numpy as np
import pandas as pd


RANDOM_SEED = 42
NUM_RECORDS = 5000

rng = np.random.default_rng(RANDOM_SEED)


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def generate_dataset() -> pd.DataFrame:
    wards = [
        "ICU",
        "General",
        "Emergency",
        "Pediatrics",
        "Surgery",
    ]

    medicines = [
        "Paracetamol",
        "Amoxicillin",
        "Ceftriaxone",
        "Insulin",
        "Ibuprofen",
        "Pantoprazole",
    ]

    frequencies = [
        "ONCE_DAILY",
        "TWICE_DAILY",
        "EVERY_8_HOURS",
        "EVERY_6_HOURS",
    ]

    data = []

    for _ in range(NUM_RECORDS):
        ward = rng.choice(wards)
        medicine = rng.choice(medicines)
        frequency = rng.choice(frequencies)

        scheduled_hour = int(
            rng.choice(
                [
                    0,
                    6,
                    8,
                    10,
                    12,
                    14,
                    16,
                    18,
                    20,
                    22,
                ]
            )
        )

        day_of_week = int(rng.integers(0, 7))

        is_stat = int(
            rng.choice(
                [0, 1],
                p=[0.85, 0.15],
            )
        )

        active_medications = int(
            rng.integers(1, 10)
        )

        previous_delays = int(
            rng.integers(0, 6)
        )

        previous_missed = int(
            rng.integers(0, 4)
        )

        ward_delay_rate = float(
            rng.uniform(0.05, 0.50)
        )

        nurse_workload = int(
            rng.integers(2, 13)
        )

        frequency_per_day = {
            "ONCE_DAILY": 1,
            "TWICE_DAILY": 2,
            "EVERY_8_HOURS": 3,
            "EVERY_6_HOURS": 4,
        }[frequency]

        # -------------------------------------------------
        # Synthetic risk generation
        # -------------------------------------------------
        # These rules create realistic-looking patterns
        # for the hackathon demo dataset.
        # They are NOT clinical rules.
        # -------------------------------------------------

        delay_score = (
    -3.8
    + 0.20 * previous_delays
    + 0.25 * previous_missed
    + 0.10 * active_medications
    + 0.12 * nurse_workload
    + 1.50 * ward_delay_rate
    + 0.08 * frequency_per_day
)

        # Busy medication periods
        if scheduled_hour in {8, 10, 12}:
            delay_score += 0.35

        # Weekend effect for the demo
        if day_of_week in {5, 6}:
            delay_score += 0.15

        # STAT medicines are treated as less likely to be delayed
        if is_stat:
            delay_score -= 0.70

        delay_probability = float(
            sigmoid(
                np.array([delay_score])
            )[0]
        )

        delayed = int(
            rng.random() < delay_probability
        )

        # -------------------------------------------------
        # Missed-dose probability
        # -------------------------------------------------
        missed_score = (
    -4.2
    + 0.30 * previous_missed
    + 0.18 * previous_delays
    + 0.10 * active_medications
    + 0.10 * nurse_workload
    + 1.40 * ward_delay_rate
)
        if delayed:
            missed_score += 0.90

        if is_stat:
            missed_score -= 0.80

        missed_probability = float(
            sigmoid(
                np.array([missed_score])
            )[0]
        )

        missed = int(
            rng.random() < missed_probability
        )

        data.append(
            {
                "ward": ward,
                "medicine": medicine,
                "frequency": frequency,
                "frequency_per_day": frequency_per_day,
                "scheduled_hour": scheduled_hour,
                "day_of_week": day_of_week,
                "is_stat": is_stat,
                "active_medications": active_medications,
                "previous_delays": previous_delays,
                "previous_missed": previous_missed,
                "ward_delay_rate": round(
                    ward_delay_rate,
                    3,
                ),
                "nurse_workload": nurse_workload,
                "delayed": delayed,
                "missed": missed,
            }
        )

    return pd.DataFrame(data)


def main() -> None:
    output_dir = Path(__file__).resolve().parent / "data"
    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_file = (
        output_dir / "synthetic_medication_history.csv"
    )

    df = generate_dataset()

    df.to_csv(
        output_file,
        index=False,
    )

    print(
        "Synthetic medication dataset generated successfully."
    )
    print("Rows:", len(df))
    print("Columns:", len(df.columns))
    print("File:", output_file)
    print()
    print("Delayed distribution:")
    print(df["delayed"].value_counts())
    print()
    print("Missed distribution:")
    print(df["missed"].value_counts())
    print()
    print("Sample:")
    print(df.head())


if __name__ == "__main__":
    main()