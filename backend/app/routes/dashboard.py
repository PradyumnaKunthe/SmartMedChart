from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, status

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
# Scoping & Role Helpers
# =========================================================

def is_admin_user(user) -> bool:
    role = getattr(user, "role", None)
    if isinstance(role, str) and role.lower() in ("admin", "administrator"):
        return True
    if role and getattr(role, "name", "").lower() in ("admin", "administrator"):
        return True
    permissions = getattr(user, "permissions", None)
    if permissions and "MANAGE_SYSTEM" in permissions:
        return True
    if role and hasattr(role, "permissions"):
        perm_names = {getattr(p, "name", str(p)) for p in role.permissions}
        if "MANAGE_SYSTEM" in perm_names:
            return True
    return False


def get_user_role_name(user) -> str:
    role = getattr(user, "role", None)
    if isinstance(role, str):
        return role.lower()
    if role and hasattr(role, "name"):
        return str(role.name).lower()
    return ""


def get_dashboard_authorized_patient_scope(current_user) -> Optional[List[int]]:
    """
    Determine the patient IDs the current user is authorized to view in dashboard monitoring.
    Returns:
    - None: Unrestricted scope (Administrator / Supervisor with MANAGE_SYSTEM).
    - List[int]: Restricted list of authorized patient IDs.
    - Raises HTTPException 403 if user has no clinical or supervisory monitoring rights.
    """
    if is_admin_user(current_user):
        return None

    role_name = get_user_role_name(current_user)
    user_id = current_user.id
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        user_id_int = user_id

    authorized_pids: Set[int] = set()

    if role_name == "doctor":
        # Attending doctor: active encounters or active prescriptions
        encounter_pids = mongo_db.encounters.distinct(
            "patient_id",
            {"doctor_id": {"$in": [user_id, str(user_id), user_id_int]}, "status": "ACTIVE"}
        )
        for p in encounter_pids:
            try:
                authorized_pids.add(int(p))
            except (ValueError, TypeError):
                pass

        rx_pids = mongo_db.prescriptions.distinct(
            "patient_id",
            {"doctor_id": {"$in": [user_id, str(user_id), user_id_int]}, "status": "ACTIVE"}
        )
        for p in rx_pids:
            try:
                authorized_pids.add(int(p))
            except (ValueError, TypeError):
                pass

        return list(authorized_pids)

    elif role_name == "nurse":
        # Active nurse assignments
        assignments = list(mongo_db.nurse_patient_assignments.find({
            "nurse_id": {"$in": [user_id, str(user_id), user_id_int]},
            "is_active": {"$in": [1, True, "1", "true"]}
        }))
        for a in assignments:
            p = a.get("patient_id")
            if p is not None:
                try:
                    authorized_pids.add(int(p))
                except (ValueError, TypeError):
                    pass

        # Covering scans within 15 minutes
        now = datetime.now(timezone.utc)
        recent_scans = list(mongo_db.qr_verifications.find({
            "verified_by": {"$in": [user_id, str(user_id), user_id_int]},
            "patient_qr_valid": True,
        }))
        for scan in recent_scans:
            v_time = scan.get("verified_at")
            if isinstance(v_time, str):
                try:
                    dt = datetime.fromisoformat(v_time.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if now - dt <= timedelta(minutes=15):
                        p = scan.get("patient_id")
                        if p is not None:
                            authorized_pids.add(int(p))
                except Exception:
                    pass

        return list(authorized_pids)

    else:
        # Non-clinical staff (e.g. Receptionist, Pharmacist) without MANAGE_SYSTEM
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to medication monitoring is restricted to authorized clinical staff or administrators.",
        )


def schedule_status_counts(base_filter: Optional[dict] = None):
    statuses = [
        "GIVEN",
        "UPCOMING",
        "DELAYED",
        "HELD",
        "REFUSED",
        "NOT_GIVEN",
    ]

    base = dict(base_filter) if base_filter else {}
    result = {}
    for stat in statuses:
        q = {**base, "status": stat}
        result[stat.lower()] = mongo_db.medication_schedules.count_documents(q)

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
    Return medication monitoring statistics from MongoDB scoped to authorized patients.
    """
    authorized_pids = get_dashboard_authorized_patient_scope(current_user)

    if authorized_pids is not None and len(authorized_pids) == 0:
        return {
            "message": "Medication monitoring summary generated successfully.",
            "summary": {
                "total": 0,
                "given": 0,
                "upcoming": 0,
                "delayed": 0,
                "held": 0,
                "refused": 0,
                "not_given": 0,
                "stat": 0,
                "ai_high_risk": 0,
            },
            "today": {
                "total": 0,
                "given": 0,
                "upcoming": 0,
                "delayed": 0,
            },
        }

    sched_filter = {}
    stat_item_filter = {"is_stat": {"$in": [1, True]}}
    ai_sched_ids = None

    if authorized_pids is not None:
        pid_candidates = []
        for p in authorized_pids:
            pid_candidates.extend([p, str(p)])
        patient_rx_ids = mongo_db.prescriptions.distinct("_id", {"patient_id": {"$in": pid_candidates}})
        patient_item_ids = mongo_db.prescription_items.distinct("_id", {"prescription_id": {"$in": patient_rx_ids}})
        sched_filter["$or"] = [
            {"patient_id": {"$in": pid_candidates}},
            {"prescription_item_id": {"$in": patient_item_ids}}
        ]
        stat_item_filter["prescription_id"] = {"$in": patient_rx_ids}
        ai_sched_ids = mongo_db.medication_schedules.distinct("_id", sched_filter)

    total = mongo_db.medication_schedules.count_documents(sched_filter)
    counts = schedule_status_counts(sched_filter)

    today_str = date.today().isoformat()
    today_filter = {**sched_filter, "scheduled_date": {"$regex": f"^{today_str}"}}

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
            stat_item_filter,
            {"_id": 1, "id": 1},
        )
    )
    stat_item_ids = [
        it.get("id", it.get("_id"))
        for it in stat_item_docs
    ]
    stat = (
        mongo_db.medication_schedules.count_documents({
            **sched_filter,
            "prescription_item_id": {"$in": stat_item_ids}
        })
        if stat_item_ids
        else 0
    )

    ai_filter = {
        "$or": [
            {"delay_risk_level": "HIGH"},
            {"missed_risk_level": "HIGH"},
        ]
    }
    if ai_sched_ids is not None:
        ai_filter["medication_schedule_id"] = {"$in": ai_sched_ids}

    ai_high_risk = mongo_db.ai_predictions.count_documents(ai_filter)

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

    authorized_pids = get_dashboard_authorized_patient_scope(current_user)
    if authorized_pids is not None and len(authorized_pids) == 0:
        return {"count": 0, "schedules": []}

    filter_query = {}
    if isinstance(status, str) and status.strip():
        filter_query["status"] = status.upper().strip()

    if authorized_pids is not None:
        pid_candidates = []
        for p in authorized_pids:
            pid_candidates.extend([p, str(p)])
        patient_rx_ids = mongo_db.prescriptions.distinct("_id", {"patient_id": {"$in": pid_candidates}})
        patient_item_ids = mongo_db.prescription_items.distinct("_id", {"prescription_id": {"$in": patient_rx_ids}})
        patient_clause = [
            {"patient_id": {"$in": pid_candidates}},
            {"prescription_item_id": {"$in": patient_item_ids}}
        ]
        if "$or" in filter_query:
            filter_query["$and"] = [{"$or": filter_query.pop("$or")}, {"$or": patient_clause}]
        else:
            filter_query["$or"] = patient_clause

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

    authorized_pids = get_dashboard_authorized_patient_scope(current_user)
    if authorized_pids is not None and len(authorized_pids) == 0:
        return {
            "count": 0,
            "risk_summary": {
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "predictions": [],
        }

    ai_query = {}
    if authorized_pids is not None:
        pid_candidates = []
        for p in authorized_pids:
            pid_candidates.extend([p, str(p)])
        patient_rx_ids = mongo_db.prescriptions.distinct("_id", {"patient_id": {"$in": pid_candidates}})
        patient_item_ids = mongo_db.prescription_items.distinct("_id", {"prescription_id": {"$in": patient_rx_ids}})
        authorized_sched_ids = mongo_db.medication_schedules.distinct("_id", {
            "$or": [
                {"patient_id": {"$in": pid_candidates}},
                {"prescription_item_id": {"$in": patient_item_ids}}
            ]
        })
        ai_query["medication_schedule_id"] = {"$in": authorized_sched_ids}

    actual_limit = limit if isinstance(limit, int) else 100

    ai_preds = list(
        mongo_db.ai_predictions.find(ai_query)
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

    authorized_pids = get_dashboard_authorized_patient_scope(current_user)
    if authorized_pids is not None and len(authorized_pids) == 0:
        return {"count": 0, "administrations": []}

    admin_query = {}
    if authorized_pids is not None:
        pid_candidates = []
        for p in authorized_pids:
            pid_candidates.extend([p, str(p)])
        admin_query["patient_id"] = {"$in": pid_candidates}

    actual_limit = limit if isinstance(limit, int) else 100

    admins = list(
        mongo_db.medication_administrations.find(admin_query)
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

    authorized_pids = get_dashboard_authorized_patient_scope(current_user)
    if authorized_pids is not None and len(authorized_pids) == 0:
        return {
            "count": 0,
            "summary": {"safe": 0, "warnings": 0, "critical": 0},
            "checks": []
        }

    sched_query = {}
    if authorized_pids is not None:
        pid_candidates = []
        for p in authorized_pids:
            pid_candidates.extend([p, str(p)])
        patient_rx_ids = mongo_db.prescriptions.distinct("_id", {"patient_id": {"$in": pid_candidates}})
        patient_item_ids = mongo_db.prescription_items.distinct("_id", {"prescription_id": {"$in": patient_rx_ids}})
        sched_query["$or"] = [
            {"patient_id": {"$in": pid_candidates}},
            {"prescription_item_id": {"$in": patient_item_ids}}
        ]

    actual_limit = limit if isinstance(limit, int) else 100

    schedules = list(
        mongo_db.medication_schedules.find(
            sched_query,
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