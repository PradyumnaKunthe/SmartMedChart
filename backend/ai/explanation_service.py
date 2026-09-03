def explain_delay_risk(data: dict) -> list[str]:
    reasons = []

    if data.get("previous_delays", 0) >= 3:
        reasons.append(
            "Previous medication doses were frequently delayed."
        )

    if data.get("previous_missed", 0) >= 2:
        reasons.append(
            "The patient has previous missed medication doses."
        )

    if data.get("active_medications", 0) >= 7:
        reasons.append(
            "The patient has a high number of active medications."
        )

    if data.get("nurse_workload", 0) >= 9:
        reasons.append(
            "Current nurse workload is relatively high."
        )

    if data.get("ward_delay_rate", 0) >= 0.35:
        reasons.append(
            "Recent medication delay rate in this ward is elevated."
        )

    if data.get("frequency_per_day", 0) >= 3:
        reasons.append(
            "The medication has multiple scheduled doses per day."
        )

    if not reasons:
        reasons.append(
            "No major high-risk contributing factors were detected."
        )

    return reasons


def explain_missed_risk(data: dict) -> list[str]:
    reasons = []

    if data.get("previous_missed", 0) >= 2:
        reasons.append(
            "Previous missed medication doses were recorded."
        )

    if data.get("previous_delays", 0) >= 3:
        reasons.append(
            "Previous medication delays may increase missed-dose risk."
        )

    if data.get("active_medications", 0) >= 7:
        reasons.append(
            "The patient has a high number of active medications."
        )

    if data.get("nurse_workload", 0) >= 9:
        reasons.append(
            "Current nurse workload is relatively high."
        )

    if data.get("ward_delay_rate", 0) >= 0.35:
        reasons.append(
            "Recent medication delay rate in this ward is elevated."
        )

    if not reasons:
        reasons.append(
            "No major high-risk contributing factors were detected."
        )

    return reasons