from prediction_service import predict_medication_risk


sample_medication = {
    "ward": "ICU",
    "medicine": "Paracetamol",
    "frequency": "EVERY_8_HOURS",
    "frequency_per_day": 3,
    "scheduled_hour": 8,
    "day_of_week": 1,
    "is_stat": 0,
    "active_medications": 7,
    "previous_delays": 3,
    "previous_missed": 1,
    "ward_delay_rate": 0.40,
    "nurse_workload": 9,
}


print("Starting AI prediction test...")


try:
    result = predict_medication_risk(
        sample_medication
    )

    print("=" * 60)
    print("SMARTMEDCHART AI PREDICTION TEST")
    print("=" * 60)

    print("\nInput:")
    for key, value in sample_medication.items():
        print(f"{key}: {value}")

    print("\nPrediction:")

    for key, value in result.items():
        print(f"{key}: {value}")

    print("\nAI prediction test completed successfully.")

except Exception as error:
    print("\nAI prediction test failed.")
    print("Error:", error)