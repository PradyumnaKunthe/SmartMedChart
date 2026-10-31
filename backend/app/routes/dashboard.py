from datetime import date

from fastapi import APIRouter, Depends, Query

from app.mongo_client import mongo_db
from app.security import require_permission
from app.services.medication_safety_service import (
    check_medication_safety,
)


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


# =========================================================
# Helpers
# =========================================================

def schedule_status_counts():
    statuses = [
        "GIVEN",
        "UPCOMING",
        "DELAYED",
        "HELD",
        "REFUSED",
        "NOT_GIVEN",
    ]

    result = {}
    for status in statuses:
        result[status.lower()] = mongo_db.medication_schedules.count_documents({
            "status": status
        })

    return result


# =========================================================
# Medication Summary
# =========================================================

@router.get("/medication-summary")
def get_medication_summary(
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return medication monitoring statistics from MongoDB.
    """

    total = mongo_db.medication_schedules.count_documents({})
    counts = schedule_status_counts()

    today_str = date.today().isoformat()
    today_filter = {"scheduled_date": {"$regex": f"^{today_str}"}}

    today_total = mongo_db.medication_schedules.count_documents(today_filter)
    today_given = mongo_db.medication_schedules.count_documents({
        **today_filter,
        "status": "GIVEN",
    })
    today_upcoming = mongo_db.medication_schedules.count_documents({
        **today_filter,
        "status": "UPCOMING",
    })
    today_delayed = mongo_db.medication_schedules.count_documents({
        **today_filter,
        "status": "DELAYED",
    })

    # Count schedules with stat prescription items
    stat_item_docs = list(
        mongo_db.prescription_items.find(
            {"is_stat": {"$in": [1, True]}},
            {"_id": 1, "id": 1},
        )
    )
    stat_item_ids = [
        it.get("id", it.get("_id"))
        for it in stat_item_docs
    ]
    stat = (
        mongo_db.medication_schedules.count_documents({
            "prescription_item_id": {"$in": stat_item_ids}
        })
        if stat_item_ids
        else 0
    )

    ai_high_risk = mongo_db.ai_predictions.count_documents({
        "$or": [
            {"delay_risk_level": "HIGH"},
            {"missed_risk_level": "HIGH"},
        ]
    })

    return {
        "message": (
            "Medication monitoring summary generated successfully."
        ),
        "summary": {
            "total": total,
            "given": counts["given"],
            "upcoming": counts["upcoming"],
            "delayed": counts["delayed"],
            "held": counts["held"],
            "refused": counts["refused"],
            "not_given": counts["not_given"],
            "stat": stat,
            "ai_high_risk": ai_high_risk,
        },
        "today": {
            "total": today_total,
            "given": today_given,
            "upcoming": today_upcoming,
            "delayed": today_delayed,
        },
    }


# =========================================================
# Technical Schedule Monitoring
# =========================================================

@router.get("/monitoring/schedules")
def get_monitoring_schedules(
    status: str | None = Query(
        default=None,
        max_length=30,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return detailed medication schedules with patient,
    medicine, prescription, and administration information.
    """

    filter_query = {}
    if isinstance(status, str) and status.strip():
        filter_query["status"] = status.upper().strip()

    actual_limit = limit if isinstance(limit, int) else 100

    schedules = list(
        mongo_db.medication_schedules.find(filter_query)
        .sort([
            ("scheduled_date", -1),
            ("scheduled_time", -1),
            ("_id", -1),
        ])
        .limit(actual_limit)
    )

    # Bulk fetch related records
    item_ids = list({
        s.get("prescription_item_id")
        for s in schedules
        if s.get("prescription_item_id") is not None
    })
    item_docs = list(
        mongo_db.prescription_items.find({
            "$or": [
                {"_id": {"$in": item_ids}},
                {"id": {"$in": item_ids}},
            ]
        })
    ) if item_ids else []
    item_map = {
        it.get("id", it.get("_id")): it
        for it in item_docs
    }

    rx_ids = list({
        it.get("prescription_id")
        for it in item_docs
        if it.get("prescription_id") is not None
    })
    rx_docs = list(
        mongo_db.prescriptions.find({
            "$or": [
                {"_id": {"$in": rx_ids}},
                {"id": {"$in": rx_ids}},
            ]
        })
    ) if rx_ids else []
    rx_map = {
        rx.get("id", rx.get("_id")): rx
        for rx in rx_docs
    }

    med_ids = list({
        it.get("medicine_id")
        for it in item_docs
        if it.get("medicine_id") is not None
    })
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {
        m.get("id", m.get("_id")): m
        for m in med_docs
    }

    pat_ids = list({
        rx.get("patient_id")
        for rx in rx_docs
        if rx.get("patient_id") is not None
    })
    pat_docs = list(
        mongo_db.patients.find({
            "$or": [
                {"_id": {"$in": pat_ids}},
                {"id": {"$in": pat_ids}},
            ]
        })
    ) if pat_ids else []
    pat_map = {
        p.get("id", p.get("_id")): p
        for p in pat_docs
    }

    user_ids = list({
        s.get("administered_by")
        for s in schedules
        if s.get("administered_by") is not None
    })
    user_docs = list(
        mongo_db.users.find({
            "$or": [
                {"_id": {"$in": user_ids}},
                {"id": {"$in": user_ids}},
            ]
        })
    ) if user_ids else []
    user_map = {
        u.get("id", u.get("_id")): u
        for u in user_docs
    }

    results = []
    for s in schedules:
        sched_id = s.get("id", s.get("_id"))
        item = item_map.get(s.get("prescription_item_id"), {})
        rx = rx_map.get(item.get("prescription_id"), {})
        med = med_map.get(item.get("medicine_id"), {})
        pat = pat_map.get(rx.get("patient_id"), {})
        user = user_map.get(s.get("administered_by"), {})

        pat_name = f"{pat.get('first_name', '')} {pat.get('last_name', '')}".strip() or "Unknown Patient"

        results.append({
            "schedule_id": sched_id,
            "scheduled_date": s.get("scheduled_date"),
            "scheduled_time": s.get("scheduled_time"),
            "status": s.get("status"),
            "actual_administration_time": s.get("actual_administration_time"),
            "administered_by": s.get("administered_by"),
            "administered_by_username": user.get("username"),
            "notes": s.get("notes"),
            "prescription_id": rx.get("id", rx.get("_id")),
            "prescription_item_id": item.get("id", item.get("_id")),
            "prescription_status": rx.get("status"),
            "patient_id": pat.get("id", pat.get("_id")),
            "patient_code": pat.get("patient_id"),
            "patient_name": pat_name,
            "doctor_id": rx.get("doctor_id"),
            "medicine_id": med.get("id", med.get("_id")),
            "medicine_name": med.get("name"),
            "generic_name": med.get("generic_name"),
            "medicine_strength": med.get("strength"),
            "dose": item.get("dose"),
            "route": item.get("route"),
            "frequency": item.get("frequency"),
            "duration_days": item.get("duration_days"),
            "is_stat": bool(item.get("is_stat") in [1, True]),
            "instructions": item.get("instructions"),
        })

    return {
        "count": len(results),
        "schedules": results,
    }


# =========================================================
# AI Monitoring
# =========================================================

@router.get("/monitoring/ai")
def get_ai_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return recent AI medication risk predictions from MongoDB.
    """

    actual_limit = limit if isinstance(limit, int) else 100

    ai_preds = list(
        mongo_db.ai_predictions.find()
        .sort([("_id", -1)])
        .limit(actual_limit)
    )

    sched_ids = list({
        p.get("medication_schedule_id")
        for p in ai_preds
        if p.get("medication_schedule_id") is not None
    })
    sched_docs = list(
        mongo_db.medication_schedules.find({
            "$or": [
                {"_id": {"$in": sched_ids}},
                {"id": {"$in": sched_ids}},
            ]
        })
    ) if sched_ids else []
    sched_map = {
        s.get("id", s.get("_id")): s
        for s in sched_docs
    }

    item_ids = list({
        s.get("prescription_item_id")
        for s in sched_docs
        if s.get("prescription_item_id") is not None
    })
    item_docs = list(
        mongo_db.prescription_items.find({
            "$or": [
                {"_id": {"$in": item_ids}},
                {"id": {"$in": item_ids}},
            ]
        })
    ) if item_ids else []
    item_map = {
        it.get("id", it.get("_id")): it
        for it in item_docs
    }

    rx_ids = list({
        it.get("prescription_id")
        for it in item_docs
        if it.get("prescription_id") is not None
    })
    rx_docs = list(
        mongo_db.prescriptions.find({
            "$or": [
                {"_id": {"$in": rx_ids}},
                {"id": {"$in": rx_ids}},
            ]
        })
    ) if rx_ids else []
    rx_map = {
        rx.get("id", rx.get("_id")): rx
        for rx in rx_docs
    }

    pat_ids = list({
        rx.get("patient_id")
        for rx in rx_docs
        if rx.get("patient_id") is not None
    })
    pat_docs = list(
        mongo_db.patients.find({
            "$or": [
                {"_id": {"$in": pat_ids}},
                {"id": {"$in": pat_ids}},
            ]
        })
    ) if pat_ids else []
    pat_map = {
        p.get("id", p.get("_id")): p
        for p in pat_docs
    }

    med_ids = list({
        it.get("medicine_id")
        for it in item_docs
        if it.get("medicine_id") is not None
    })
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {
        m.get("id", m.get("_id")): m
        for m in med_docs
    }

    high = 0
    medium = 0
    low = 0
    predictions = []

    for ai in ai_preds:
        levels = [
            ai.get("delay_risk_level"),
            ai.get("missed_risk_level"),
        ]

        if "HIGH" in levels:
            high += 1
        elif "MEDIUM" in levels:
            medium += 1
        else:
            low += 1

        sched = sched_map.get(ai.get("medication_schedule_id"), {})
        item = item_map.get(sched.get("prescription_item_id"), {})
        rx = rx_map.get(item.get("prescription_id"), {})
        pat = pat_map.get(rx.get("patient_id"), {})
        med = med_map.get(item.get("medicine_id"), {})

        delay_prob = float(ai.get("delay_probability") or 0.0)
        missed_prob = float(ai.get("missed_probability") or 0.0)
        pat_name = f"{pat.get('first_name', '')} {pat.get('last_name', '')}".strip() or "Unknown Patient"

        predictions.append({
            "prediction_id": ai.get("id", ai.get("_id")),
            "schedule_id": ai.get("medication_schedule_id"),
            "patient_code": pat.get("patient_id"),
            "patient_name": pat_name,
            "medicine_name": med.get("name"),
            "scheduled_date": sched.get("scheduled_date"),
            "scheduled_time": sched.get("scheduled_time"),
            "delay_probability": delay_prob,
            "delay_risk_percent": round(delay_prob * 100, 2),
            "delay_risk_level": ai.get("delay_risk_level"),
            "missed_probability": missed_prob,
            "missed_risk_percent": round(missed_prob * 100, 2),
            "missed_risk_level": ai.get("missed_risk_level"),
        })

    return {
        "count": len(predictions),
        "risk_summary": {
            "high": high,
            "medium": medium,
            "low": low,
        },
        "predictions": predictions,
    }


# =========================================================
# Administration Monitoring
# =========================================================

@router.get("/monitoring/administrations")
def get_administration_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Return detailed medication administration audit data from MongoDB.
    """

    actual_limit = limit if isinstance(limit, int) else 100

    admins = list(
        mongo_db.medication_administrations.find()
        .sort([("_id", -1)])
        .limit(actual_limit)
    )

    sched_ids = list({
        a.get("medication_schedule_id")
        for a in admins
        if a.get("medication_schedule_id") is not None
    })
    sched_docs = list(
        mongo_db.medication_schedules.find({
            "$or": [
                {"_id": {"$in": sched_ids}},
                {"id": {"$in": sched_ids}},
            ]
        })
    ) if sched_ids else []
    sched_map = {
        s.get("id", s.get("_id")): s
        for s in sched_docs
    }

    item_ids = list({
        s.get("prescription_item_id")
        for s in sched_docs
        if s.get("prescription_item_id") is not None
    })
    item_docs = list(
        mongo_db.prescription_items.find({
            "$or": [
                {"_id": {"$in": item_ids}},
                {"id": {"$in": item_ids}},
            ]
        })
    ) if item_ids else []
    item_map = {
        it.get("id", it.get("_id")): it
        for it in item_docs
    }

    rx_ids = list({
        it.get("prescription_id")
        for it in item_docs
        if it.get("prescription_id") is not None
    })
    rx_docs = list(
        mongo_db.prescriptions.find({
            "$or": [
                {"_id": {"$in": rx_ids}},
                {"id": {"$in": rx_ids}},
            ]
        })
    ) if rx_ids else []
    rx_map = {
        rx.get("id", rx.get("_id")): rx
        for rx in rx_docs
    }

    pat_ids = list({
        rx.get("patient_id")
        for rx in rx_docs
        if rx.get("patient_id") is not None
    })
    pat_docs = list(
        mongo_db.patients.find({
            "$or": [
                {"_id": {"$in": pat_ids}},
                {"id": {"$in": pat_ids}},
            ]
        })
    ) if pat_ids else []
    pat_map = {
        p.get("id", p.get("_id")): p
        for p in pat_docs
    }

    med_ids = list({
        it.get("medicine_id")
        for it in item_docs
        if it.get("medicine_id") is not None
    })
    med_docs = list(
        mongo_db.medicines.find({
            "$or": [
                {"_id": {"$in": med_ids}},
                {"id": {"$in": med_ids}},
            ]
        })
    ) if med_ids else []
    med_map = {
        m.get("id", m.get("_id")): m
        for m in med_docs
    }

    user_ids = list({
        a.get("administered_by")
        for a in admins
        if a.get("administered_by") is not None
    })
    user_docs = list(
        mongo_db.users.find({
            "$or": [
                {"_id": {"$in": user_ids}},
                {"id": {"$in": user_ids}},
            ]
        })
    ) if user_ids else []
    user_map = {
        u.get("id", u.get("_id")): u
        for u in user_docs
    }

    results = []
    for adm in admins:
        sched = sched_map.get(adm.get("medication_schedule_id"), {})
        item = item_map.get(sched.get("prescription_item_id"), {})
        rx = rx_map.get(item.get("prescription_id"), {})
        pat = pat_map.get(rx.get("patient_id"), {})
        med = med_map.get(item.get("medicine_id"), {})
        user = user_map.get(adm.get("administered_by"), {})

        pat_name = f"{pat.get('first_name', '')} {pat.get('last_name', '')}".strip() or "Unknown Patient"

        results.append({
            "administration_id": adm.get("id", adm.get("_id")),
            "schedule_id": adm.get("medication_schedule_id"),
            "status": adm.get("status"),
            "administered_by": adm.get("administered_by"),
            "administered_by_username": user.get("username"),
            "administered_at": adm.get("administered_at"),
            "notes": adm.get("notes"),
            "scheduled_date": sched.get("scheduled_date"),
            "scheduled_time": sched.get("scheduled_time"),
            "patient_code": pat.get("patient_id"),
            "patient_name": pat_name,
            "medicine_name": med.get("name"),
        })

    return {
        "count": len(results),
        "administrations": results,
    }


# =========================================================
# Safety Monitoring
# =========================================================

@router.get("/monitoring/safety")
def get_safety_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
    ),
    current_user=Depends(
        require_permission("VIEW_MEDICATION_SCHEDULE")
    ),
):
    """
    Run safety checks for medication schedules and return results from MongoDB.
    """

    actual_limit = limit if isinstance(limit, int) else 100

    schedules = list(
        mongo_db.medication_schedules.find(
            {},
            {"_id": 1, "id": 1},
        )
        .sort([("_id", -1)])
        .limit(actual_limit)
    )

    results = []
    safe_count = 0
    warning_count = 0
    critical_count = 0

    for s in schedules:
        schedule_id = s.get("id", s.get("_id"))
        try:
            result = check_medication_safety(schedule_id=schedule_id)
            results.append(result)

            if result.get("safe"):
                safe_count += 1
            else:
                severity = str(result.get("severity", "")).upper()
                if severity in {"HIGH", "CRITICAL", "SEVERE"}:
                    critical_count += 1
                else:
                    warning_count += 1

        except ValueError:
            continue

    return {
        "count": len(results),
        "summary": {
            "safe": safe_count,
            "warnings": warning_count,
            "critical": critical_count,
        },
        "checks": results,
    }