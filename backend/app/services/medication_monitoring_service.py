from datetime import datetime, date, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo import ReturnDocument

from app.mongo_client import mongo_db, next_mongo_id


# =========================================================
# HOSPITAL MONITORING POLICY
# =========================================================
DEFAULT_HOSPITAL_POLICY = {
    "policy_name": "SmartMedChart Standard Inpatient Administration Policy",
    "on_time_grace_before_minutes": 30,   # Medication is DUE 30 mins before scheduled time
    "on_time_grace_after_minutes": 60,    # GIVEN within 60 mins after scheduled time is ON TIME
    "missed_cutoff_minutes": 240,         # After 240 mins (4 hours) without administration, marked MISSED
    "require_override_reason": True,      # If administering nurse != assigned nurse
}


def get_hospital_policy() -> Dict[str, Any]:
    """Retrieve hospital policy from MongoDB or fallback to standard policy."""
    try:
        policy = mongo_db.hospital_policies.find_one({"_id": "medication_administration"})
        if policy:
            return {**DEFAULT_HOSPITAL_POLICY, **policy}
    except Exception:
        pass
    return DEFAULT_HOSPITAL_POLICY


def set_hospital_policy(new_policy: Dict[str, Any]) -> Dict[str, Any]:
    """Update hospital administration policy."""
    policy_data = {**DEFAULT_HOSPITAL_POLICY, **new_policy, "updated_at": datetime.now(timezone.utc).isoformat()}
    mongo_db.hospital_policies.update_one(
        {"_id": "medication_administration"},
        {"$set": policy_data},
        upsert=True,
    )
    return policy_data


# =========================================================
# DATETIME PARSING HELPERS
# =========================================================
def parse_iso_or_sql_datetime(dt_val: Any) -> Optional[datetime]:
    if not dt_val:
        return None
    if isinstance(dt_val, datetime):
        return dt_val
    dt_str = str(dt_val).strip()
    # Try ISO format
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        pass
    # Try standard SQL timestamps
    formats = [
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except Exception:
            continue
    return None


def parse_schedule_datetime(scheduled_date_val: Any, scheduled_time_val: Any) -> Optional[datetime]:
    """Combine scheduled date and time into a single datetime object."""
    if not scheduled_date_val:
        return None
    
    date_part = str(scheduled_date_val).split("T")[0].strip()
    time_part = "08:00:00"
    if scheduled_time_val:
        time_part = str(scheduled_time_val).split(".")[0].strip()
        if len(time_part) == 5:  # HH:MM
            time_part += ":00"

    combined_str = f"{date_part} {time_part}"
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"]:
        try:
            return datetime.strptime(combined_str, fmt)
        except Exception:
            continue
    return None


# =========================================================
# MONITORING STATUS EVALUATION
# =========================================================
def compute_monitoring_status(
    schedule: Dict[str, Any],
    current_dt: Optional[datetime] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Tuple[str, float]:
    """
    Determine the real clinical monitoring status of a medication schedule.
    Returns (status, delay_minutes).
    
    Possible statuses:
    - UPCOMING
    - DUE
    - GIVEN_ON_TIME
    - GIVEN_LATE
    - OVERDUE
    - MISSED
    - HELD
    - REFUSED
    - NOT_GIVEN
    """
    if current_dt is None:
        current_dt = datetime.now()
    if policy is None:
        policy = get_hospital_policy()

    grace_before = policy.get("on_time_grace_before_minutes", 30)
    grace_after = policy.get("on_time_grace_after_minutes", 60)
    missed_cutoff = policy.get("missed_cutoff_minutes", 240)

    scheduled_dt = parse_schedule_datetime(
        schedule.get("scheduled_date"),
        schedule.get("scheduled_time")
    )

    actual_time_val = schedule.get("actual_administration_time")
    raw_status = str(schedule.get("status") or "").upper().strip()

    # 1. Non-administration clinical outcomes
    if raw_status in {"HELD", "REFUSED", "NOT_GIVEN"}:
        return raw_status, 0.0

    # 2. Administered medication outcomes
    if actual_time_val or raw_status in {"GIVEN", "GIVEN_ON_TIME", "GIVEN_LATE", "GIVEN_EARLY"}:
        actual_dt = parse_iso_or_sql_datetime(actual_time_val)
        if actual_dt and scheduled_dt:
            # Handle timezone: if actual_dt is timezone-aware (e.g. UTC from authoritative server clock),
            # convert to hospital timezone (Asia/Kolkata) to compare with scheduled local hospital datetime.
            if actual_dt.tzinfo is not None:
                try:
                    from zoneinfo import ZoneInfo
                    hosp_tz = ZoneInfo("Asia/Kolkata")
                except Exception:
                    hosp_tz = timezone(timedelta(hours=5, minutes=30))
                act = actual_dt.astimezone(hosp_tz).replace(tzinfo=None)
            else:
                act = actual_dt
            sch = scheduled_dt.replace(tzinfo=None) if scheduled_dt.tzinfo else scheduled_dt
            diff_minutes = (act - sch).total_seconds() / 60.0

            if diff_minutes < -grace_before:
                return "GIVEN_EARLY", round(diff_minutes, 1)
            elif diff_minutes <= grace_after:
                return "GIVEN_ON_TIME", round(diff_minutes, 1)
            else:
                return "GIVEN_LATE", round(diff_minutes, 1)

        # Fallback if actual_time_val is missing but status was recorded
        if raw_status in {"GIVEN_LATE", "GIVEN_EARLY"}:
            return raw_status, 65.0 if raw_status == "GIVEN_LATE" else -35.0
        return "GIVEN_ON_TIME", 0.0

    # 3. Unadministered schedules evaluated against current time
    if scheduled_dt:
        if current_dt.tzinfo is not None:
            try:
                from zoneinfo import ZoneInfo
                hosp_tz = ZoneInfo("Asia/Kolkata")
            except Exception:
                hosp_tz = timezone(timedelta(hours=5, minutes=30))
            cur = current_dt.astimezone(hosp_tz).replace(tzinfo=None)
        else:
            cur = current_dt
        sch = scheduled_dt.replace(tzinfo=None) if scheduled_dt.tzinfo else scheduled_dt
        diff_minutes = (cur - sch).total_seconds() / 60.0

        if diff_minutes < -grace_before:
            return "UPCOMING", round(diff_minutes, 1)
        elif -grace_before <= diff_minutes <= grace_after:
            return "DUE", round(diff_minutes, 1)
        elif grace_after < diff_minutes <= missed_cutoff:
            return "OVERDUE", round(diff_minutes, 1)
        else:
            return "MISSED", round(diff_minutes, 1)

    # Fallback to UPCOMING if schedule datetime cannot be parsed
    return "UPCOMING", 0.0


# =========================================================
# ALERTS SYNCHRONIZATION
# =========================================================
def sync_medication_alerts() -> List[Dict[str, Any]]:
    """
    Inspect active unadministered schedules, compute overdue/missed statuses,
    and generate alerts in MongoDB without creating duplicate notifications.
    """
    now = datetime.now()
    policy = get_hospital_policy()

    # Find unadministered schedules
    unadministered_schedules = list(mongo_db.medication_schedules.find({
        "status": {"$in": ["UPCOMING", "DUE", "OVERDUE", "MISSED", "SCHEDULED", None]},
        "actual_administration_time": {"$in": [None, ""]},
    }))

    generated_alerts = []

    for schedule in unadministered_schedules:
        schedule_id = schedule.get("id", schedule.get("_id"))
        status, delay_mins = compute_monitoring_status(schedule, current_dt=now, policy=policy)

        if status not in {"OVERDUE", "MISSED"}:
            continue

        alert_type = status  # OVERDUE or MISSED
        severity = "CRITICAL" if alert_type == "MISSED" else "WARNING"

        # Check if an alert for this schedule and type already exists to avoid duplicate spam
        existing = mongo_db.medication_alerts.find_one({
            "medication_schedule_id": int(schedule_id),
            "alert_type": alert_type,
        })
        if existing:
            continue

        # Fetch context (patient, prescription item, medicine)
        item = mongo_db.prescription_items.find_one({
            "$or": [{"_id": schedule.get("prescription_item_id")}, {"id": schedule.get("prescription_item_id")}]
        })
        if not item:
            continue

        prescription = mongo_db.prescriptions.find_one({
            "$or": [{"_id": item.get("prescription_id")}, {"id": item.get("prescription_id")}]
        })
        if not prescription:
            continue

        patient = mongo_db.patients.find_one({
            "$or": [{"_id": prescription.get("patient_id")}, {"id": prescription.get("patient_id")}]
        })
        medicine = mongo_db.medicines.find_one({
            "$or": [{"_id": item.get("medicine_id")}, {"id": item.get("medicine_id")}]
        })

        patient_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip() if patient else "Unknown"
        patient_code = patient.get("patient_id", f"#{prescription.get('patient_id')}") if patient else "N/A"
        medicine_name = medicine.get("name", "Medication") if medicine else "Medication"

        # Find assigned nurse(s) for notification
        assigned_nurse_ids = []
        if patient:
            p_id = patient.get("id", patient.get("_id"))
            assignments = mongo_db.nurse_patient_assignments.find({
                "patient_id": int(p_id),
                "is_active": {"$in": [1, True]},
            })
            assigned_nurse_ids = [int(a["nurse_id"]) for a in assignments if a.get("nurse_id")]

        new_alert_id = next_mongo_id("medication_alerts")
        alert_doc = {
            "_id": new_alert_id,
            "id": new_alert_id,
            "medication_schedule_id": int(schedule_id),
            "patient_id": patient.get("id", patient.get("_id")) if patient else None,
            "patient_name": patient_name,
            "patient_code": patient_code,
            "medicine_name": medicine_name,
            "dose": item.get("dose"),
            "route": item.get("route"),
            "scheduled_date": schedule.get("scheduled_date"),
            "scheduled_time": schedule.get("scheduled_time"),
            "alert_type": alert_type,
            "severity": severity,
            "delay_minutes": delay_mins,
            "assigned_nurse_ids": assigned_nurse_ids,
            "is_acknowledged": False,
            "acknowledged_by": None,
            "acknowledged_by_name": None,
            "acknowledged_at": None,
            "acknowledgement_note": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        mongo_db.medication_alerts.insert_one(alert_doc)
        generated_alerts.append(alert_doc)

    return generated_alerts


# =========================================================
# MONITORING DASHBOARD AGGREGATIONS & DETAILS
# =========================================================
def get_monitoring_dashboard(
    date_filter: Optional[str] = None,
    patient_filter: Optional[str] = None,
    ward_filter: Optional[str] = None,
    nurse_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Produce unified monitoring statistics and detailed schedule records.
    """
    # Trigger alert sync
    sync_medication_alerts()
    policy = get_hospital_policy()
    now = datetime.now()

    # Preload users and medicines for fast lookup
    users_map = {u.get("id", u.get("_id")): u for u in mongo_db.users.find({})}
    medicines_map = {m.get("id", m.get("_id")): m for m in mongo_db.medicines.find({})}
    patients_map = {p.get("id", p.get("_id")): p for p in mongo_db.patients.find({})}
    items_map = {i.get("id", i.get("_id")): i for i in mongo_db.prescription_items.find({})}
    prescriptions_map = {pr.get("id", pr.get("_id")): pr for pr in mongo_db.prescriptions.find({})}
    administrations_map = {
        adm.get("medication_schedule_id"): adm
        for adm in mongo_db.medication_administrations.find({})
    }

    # Preload patient active nurse assignments
    patient_assigned_nurses = {}
    for a in mongo_db.nurse_patient_assignments.find({"is_active": {"$in": [1, True]}}):
        p_id = a.get("patient_id")
        n_id = a.get("nurse_id")
        if p_id and n_id:
            patient_assigned_nurses.setdefault(int(p_id), []).append(int(n_id))

    # Fetch schedules
    query = {}
    if date_filter:
        query["scheduled_date"] = date_filter

    raw_schedules = list(mongo_db.medication_schedules.find(query).sort([
        ("scheduled_date", -1),
        ("scheduled_time", 1),
    ]))

    detailed_schedules = []
    counts = {
        "total_scheduled": 0,
        "upcoming": 0,
        "due": 0,
        "given_on_time": 0,
        "given_late": 0,
        "given_early": 0,
        "overdue": 0,
        "missed": 0,
        "held": 0,
        "refused": 0,
        "not_given": 0,
        "overrides_count": 0,
    }

    for schedule in raw_schedules:
        s_id = schedule.get("id", schedule.get("_id"))
        item_id = schedule.get("prescription_item_id")
        item = items_map.get(item_id)
        if not item:
            continue

        prescription = prescriptions_map.get(item.get("prescription_id"))
        if not prescription:
            continue

        patient_id = prescription.get("patient_id")
        patient = patients_map.get(patient_id)
        if not patient:
            continue

        medicine = medicines_map.get(item.get("medicine_id"))
        medicine_name = medicine.get("name", "Medication") if medicine else "Medication"

        # Monitoring status and delay
        mon_status, delay_mins = compute_monitoring_status(schedule, current_dt=now, policy=policy)

        # Administration accountability record
        adm_record = administrations_map.get(int(s_id))
        administering_nurse_id = None
        administering_nurse_name = None
        is_override = False
        override_reason = None
        qr_verification_ref = None

        if adm_record:
            administering_nurse_id = adm_record.get("administered_by")
            administering_nurse = users_map.get(administering_nurse_id)
            administering_nurse_name = (
                adm_record.get("nurse_name")
                or (administering_nurse.get("full_name") if administering_nurse else None)
                or f"Nurse #{administering_nurse_id}"
            )
            is_override = bool(adm_record.get("is_override", False))
            override_reason = adm_record.get("override_reason")
            qr_verification_ref = adm_record.get("verification_id")
        elif schedule.get("administered_by"):
            administering_nurse_id = schedule.get("administered_by")
            administering_nurse = users_map.get(administering_nurse_id)
            administering_nurse_name = administering_nurse.get("full_name") if administering_nurse else f"Nurse #{administering_nurse_id}"

        # Assigned nurse(s) for patient
        assigned_nurse_ids = patient_assigned_nurses.get(int(patient_id), [])
        assigned_nurse_names = [
            users_map.get(nid, {}).get("full_name", f"Nurse #{nid}")
            for nid in assigned_nurse_ids
        ]

        if is_override:
            counts["overrides_count"] += 1

        # Count monitoring statuses
        counts["total_scheduled"] += 1
        key = mon_status.lower()
        if key in counts:
            counts[key] += 1

        patient_full_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()
        patient_code = patient.get("patient_id", f"#{patient_id}")
        ward_id = patient.get("ward_id")
        ward_name = patient.get("ward_name") or (f"Ward #{ward_id}" if ward_id else "Unassigned")

        row = {
            "schedule_id": int(s_id),
            "patient_id": int(patient_id),
            "patient_name": patient_full_name,
            "patient_code": patient_code,
            "ward_id": ward_id,
            "ward_name": ward_name,
            "medicine_id": item.get("medicine_id"),
            "medicine_name": medicine_name,
            "dose": item.get("dose"),
            "route": item.get("route"),
            "frequency": item.get("frequency"),
            "is_stat": bool(item.get("is_stat", False)),
            "scheduled_date": schedule.get("scheduled_date"),
            "scheduled_time": schedule.get("scheduled_time"),
            "actual_administration_time": schedule.get("actual_administration_time"),
            "monitoring_status": mon_status,
            "delay_minutes": delay_mins,
            "administering_nurse_id": administering_nurse_id,
            "administering_nurse_name": administering_nurse_name,
            "assigned_nurse_ids": assigned_nurse_ids,
            "assigned_nurse_names": assigned_nurse_names,
            "is_override": is_override,
            "override_reason": override_reason,
            "qr_verification_ref": qr_verification_ref,
            "notes": schedule.get("notes") or (adm_record.get("notes") if adm_record else None),
        }

        # Filtering logic
        if patient_filter:
            term = patient_filter.lower()
            if term not in patient_full_name.lower() and term not in patient_code.lower():
                continue

        if ward_filter:
            if str(ward_id) != str(ward_filter) and ward_name.lower() != ward_filter.lower():
                continue

        if nurse_filter:
            nid = str(nurse_filter)
            n_name = nurse_filter.lower()
            match_adm = (str(administering_nurse_id) == nid) or (administering_nurse_name and n_name in administering_nurse_name.lower())
            match_ass = (int(nurse_filter) in assigned_nurse_ids if nurse_filter.isdigit() else False) or any(n_name in an.lower() for an in assigned_nurse_names)
            if not (match_adm or match_ass):
                continue

        if status_filter and status_filter.upper() != "ALL":
            if mon_status.upper() != status_filter.upper():
                continue

        detailed_schedules.append(row)

    # Compute overall compliance percentages
    total_completed = counts["given_on_time"] + counts["given_late"] + counts.get("given_early", 0)
    total_actioned = total_completed + counts["held"] + counts["refused"] + counts["not_given"]
    on_time_rate = round((counts["given_on_time"] / total_completed * 100), 1) if total_completed > 0 else 100.0
    overall_compliance = round(((counts["given_on_time"] + counts["held"]) / counts["total_scheduled"] * 100), 1) if counts["total_scheduled"] > 0 else 100.0

    # Fetch active unacknowledged alerts
    active_alerts = list(mongo_db.medication_alerts.find({"is_acknowledged": False}).sort([("created_at", -1)]).limit(20))
    for a in active_alerts:
        a["id"] = a.get("id", a.get("_id"))
        if "_id" in a:
            a["_id"] = str(a["_id"])

    return {
        "policy": policy,
        "counts": counts,
        "metrics": {
            "on_time_rate": on_time_rate,
            "compliance_rate": overall_compliance,
            "active_alerts_count": len(active_alerts),
        },
        "schedules": detailed_schedules,
        "alerts": active_alerts,
    }


# =========================================================
# COMPLIANCE REPORTING
# =========================================================
def get_compliance_reports() -> Dict[str, Any]:
    """
    Generate auditable reports for on-time administration %, delays, missed doses,
    breakdown by nurse, and ward-wise compliance.
    """
    data = get_monitoring_dashboard()
    schedules = data["schedules"]
    counts = data["counts"]
    metrics = data["metrics"]

    # 1. Nurse breakdown
    nurse_stats: Dict[int, Dict[str, Any]] = {}
    for s in schedules:
        adm_id = s.get("administering_nurse_id")
        if not adm_id:
            continue
        if adm_id not in nurse_stats:
            nurse_stats[adm_id] = {
                "nurse_id": adm_id,
                "nurse_name": s.get("administering_nurse_name", f"Nurse #{adm_id}"),
                "total_administered": 0,
                "given_on_time": 0,
                "given_late": 0,
                "held": 0,
                "refused": 0,
                "not_given": 0,
                "overrides": 0,
            }
        
        entry = nurse_stats[adm_id]
        entry["total_administered"] += 1
        st = s.get("monitoring_status")
        if st == "GIVEN_ON_TIME":
            entry["given_on_time"] += 1
        elif st == "GIVEN_LATE":
            entry["given_late"] += 1
        elif st == "GIVEN_EARLY":
            entry.setdefault("given_early", 0)
            entry["given_early"] += 1
        elif st == "HELD":
            entry["held"] += 1
        elif st == "REFUSED":
            entry["refused"] += 1
        elif st == "NOT_GIVEN":
            entry["not_given"] += 1
        
        if s.get("is_override"):
            entry["overrides"] += 1

    by_nurse_list = []
    for entry in nurse_stats.values():
        total_given = entry["given_on_time"] + entry["given_late"] + entry.get("given_early", 0)
        on_time_pct = round((entry["given_on_time"] / total_given * 100), 1) if total_given > 0 else 100.0
        by_nurse_list.append({**entry, "on_time_pct": on_time_pct})

    by_nurse_list.sort(key=lambda x: x["total_administered"], reverse=True)

    # 2. Ward breakdown
    ward_stats: Dict[str, Dict[str, Any]] = {}
    for s in schedules:
        ward_name = s.get("ward_name") or "Unassigned"
        if ward_name not in ward_stats:
            ward_stats[ward_name] = {
                "ward_name": ward_name,
                "total_scheduled": 0,
                "given_on_time": 0,
                "given_late": 0,
                "given_early": 0,
                "overdue": 0,
                "missed": 0,
            }
        w = ward_stats[ward_name]
        w["total_scheduled"] += 1
        st = s.get("monitoring_status")
        if st == "GIVEN_ON_TIME":
            w["given_on_time"] += 1
        elif st == "GIVEN_LATE":
            w["given_late"] += 1
        elif st == "GIVEN_EARLY":
            w["given_early"] += 1
        elif st == "OVERDUE":
            w["overdue"] += 1
        elif st == "MISSED":
            w["missed"] += 1

    by_ward_list = []
    for w in ward_stats.values():
        completed = w["given_on_time"] + w["given_late"] + w.get("given_early", 0)
        comp_rate = round((w["given_on_time"] / w["total_scheduled"] * 100), 1) if w["total_scheduled"] > 0 else 100.0
        by_ward_list.append({**w, "compliance_rate": comp_rate})

    by_ward_list.sort(key=lambda x: x["total_scheduled"], reverse=True)

    return {
        "summary": {
            "total_scheduled": counts["total_scheduled"],
            "given_on_time": counts["given_on_time"],
            "given_late": counts["given_late"],
            "overdue": counts["overdue"],
            "missed": counts["missed"],
            "on_time_percentage": metrics["on_time_rate"],
            "overall_compliance_percentage": metrics["compliance_rate"],
        },
        "by_nurse": by_nurse_list,
        "by_ward": by_ward_list,
        "disclaimer": (
            "Clinical Compliance Notice: These metrics are synthesized for internal quality "
            "assurance and nurse workflow monitoring. They do not constitute sole evidence of clinical performance "
            "without documented supervisor peer review."
        ),
    }
