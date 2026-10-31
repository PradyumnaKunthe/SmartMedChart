from datetime import datetime

from app.mongo_client import mongo_db


def build_medication_features(
    schedule_id: int = None,
    db=None,
    **kwargs,
) -> dict:
    """
    Build AI features from a real SmartMedChart
    medication schedule using MongoDB.
    """

    if schedule_id is None and "schedule_id" in kwargs:
        schedule_id = kwargs["schedule_id"]

    if schedule_id is None:
        raise ValueError("schedule_id is required.")

    # =====================================================
    # 1. Load schedule and related records
    # =====================================================

    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": schedule_id},
            {"id": schedule_id},
        ]
    })

    if schedule is None:
        raise ValueError("Medication schedule not found.")

    actual_schedule_id = schedule.get("id", schedule.get("_id"))
    item_id = schedule.get("prescription_item_id")

    item = mongo_db.prescription_items.find_one({
        "$or": [
            {"_id": item_id},
            {"id": item_id},
        ]
    })

    if item is None:
        raise ValueError("Prescription item not found.")

    prescription_id = item.get("prescription_id")
    prescription = mongo_db.prescriptions.find_one({
        "$or": [
            {"_id": prescription_id},
            {"id": prescription_id},
        ]
    })

    if prescription is None:
        raise ValueError("Prescription not found.")

    patient_id = prescription.get("patient_id")
    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": patient_id},
            {"id": patient_id},
        ]
    })

    if patient is None:
        raise ValueError("Patient not found.")

    medicine_id = item.get("medicine_id")
    medicine = mongo_db.medicines.find_one({
        "$or": [
            {"_id": medicine_id},
            {"id": medicine_id},
        ]
    })

    if medicine is None:
        raise ValueError("Medicine not found.")

    ward = None
    ward_id = patient.get("ward_id")
    if ward_id:
        ward = mongo_db.wards.find_one({
            "$or": [
                {"_id": ward_id},
                {"id": ward_id},
            ]
        })

    # =====================================================
    # 2. Scheduled date and time features
    # =====================================================

    sched_date_val = schedule.get("scheduled_date")
    sched_time_val = schedule.get("scheduled_time")

    if isinstance(sched_date_val, str):
        try:
            d_obj = datetime.strptime(sched_date_val[:10], "%Y-%m-%d").date()
        except Exception:
            d_obj = datetime.now().date()
    elif hasattr(sched_date_val, "year"):
        d_obj = sched_date_val
    else:
        d_obj = datetime.now().date()

    if isinstance(sched_time_val, str):
        try:
            t_part = sched_time_val.split(".")[0].strip()
            t_obj = datetime.strptime(t_part, "%H:%M:%S").time()
        except Exception:
            t_obj = datetime.now().time()
    elif hasattr(sched_time_val, "hour"):
        t_obj = sched_time_val
    else:
        t_obj = datetime.now().time()

    scheduled_datetime = datetime.combine(d_obj, t_obj)
    scheduled_hour = scheduled_datetime.hour
    day_of_week = scheduled_datetime.weekday()

    # =====================================================
    # 3. Frequency -> doses per day
    # =====================================================

    frequency_per_day_map = {
        "ONCE_DAILY": 1,
        "TWICE_DAILY": 2,
        "EVERY_8_HOURS": 3,
        "EVERY_6_HOURS": 4,
    }

    frequency_str = item.get("frequency", "ONCE_DAILY")
    frequency_per_day = frequency_per_day_map.get(
        frequency_str,
        1,
    )

    # =====================================================
    # 4. Number of active medications for this patient
    # =====================================================

    active_rx_docs = list(
        mongo_db.prescriptions.find({
            "patient_id": patient_id,
            "status": "ACTIVE",
        }, {"_id": 1, "id": 1})
    )
    active_rx_ids = [
        rx.get("id", rx.get("_id"))
        for rx in active_rx_docs
    ]

    active_medications = mongo_db.prescription_items.count_documents({
        "prescription_id": {"$in": active_rx_ids},
        "status": "ACTIVE",
    }) if active_rx_ids else 0

    # =====================================================
    # 5. Previous delayed doses for this patient
    # =====================================================

    all_patient_rx_docs = list(
        mongo_db.prescriptions.find({
            "patient_id": patient_id,
        }, {"_id": 1, "id": 1})
    )
    all_patient_rx_ids = [
        rx.get("id", rx.get("_id"))
        for rx in all_patient_rx_docs
    ]

    all_patient_item_docs = list(
        mongo_db.prescription_items.find({
            "prescription_id": {"$in": all_patient_rx_ids},
        }, {"_id": 1, "id": 1})
    ) if all_patient_rx_ids else []

    all_patient_item_ids = [
        it.get("id", it.get("_id"))
        for it in all_patient_item_docs
    ]

    previous_delays = 0
    previous_missed = 0

    if all_patient_item_ids:
        previous_delays = mongo_db.medication_schedules.count_documents({
            "prescription_item_id": {"$in": all_patient_item_ids},
            "status": "DELAYED",
            "_id": {"$ne": actual_schedule_id},
            "id": {"$ne": actual_schedule_id},
        })

        previous_missed = mongo_db.medication_schedules.count_documents({
            "prescription_item_id": {"$in": all_patient_item_ids},
            "status": "NOT_GIVEN",
            "_id": {"$ne": actual_schedule_id},
            "id": {"$ne": actual_schedule_id},
        })

    # =====================================================
    # 6. Ward name
    # =====================================================

    ward_name = (
        ward.get("name")
        if ward and ward.get("name")
        else "General"
    )

    # =====================================================
    # 7. Calculate GLOBAL historical delay rate
    # =====================================================

    completed_statuses = [
        "GIVEN",
        "DELAYED",
        "HELD",
        "REFUSED",
        "NOT_GIVEN",
    ]

    total_completed = mongo_db.medication_schedules.count_documents({
        "status": {"$in": completed_statuses}
    })

    total_delayed = mongo_db.medication_schedules.count_documents({
        "status": "DELAYED"
    })

    if total_completed > 0:
        ward_delay_rate = total_delayed / total_completed
    else:
        ward_delay_rate = 0.0

    # =====================================================
    # 8. Calculate medication workload proxy
    # =====================================================

    workload_start_hour = max(scheduled_hour - 1, 0)
    workload_end_hour = min(scheduled_hour + 1, 23)

    upcoming_schedules = list(
        mongo_db.medication_schedules.find(
            {"status": "UPCOMING"},
            {"scheduled_time": 1}
        )
    )

    nurse_workload = 0
    for s in upcoming_schedules:
        t_val = s.get("scheduled_time")
        if t_val:
            try:
                h = int(str(t_val).split(":")[0].strip())
                if workload_start_hour <= h <= workload_end_hour:
                    nurse_workload += 1
            except Exception:
                pass

    nurse_workload = min(max(int(nurse_workload), 0), 12)

    is_stat_val = 1 if item.get("is_stat") in (1, True) else 0

    # =====================================================
    # 9. Return AI features
    # =====================================================

    return {
        "ward": ward_name,
        "medicine": medicine.get("name", "Unknown"),
        "frequency": frequency_str,
        "frequency_per_day": int(frequency_per_day),
        "scheduled_hour": int(scheduled_hour),
        "day_of_week": int(day_of_week),
        "is_stat": int(is_stat_val),
        "active_medications": int(active_medications),
        "previous_delays": int(previous_delays),
        "previous_missed": int(previous_missed),
        "ward_delay_rate": float(ward_delay_rate),
        "nurse_workload": int(nurse_workload),
    }