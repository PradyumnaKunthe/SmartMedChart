from datetime import datetime, date, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo import ReturnDocument

from app.mongo_client import mongo_db, next_mongo_id


def init_notification_indexes():
    """Ensure indexes exist for medication notifications."""
    try:
        mongo_db.medication_notifications.create_index(
            [("medication_schedule_id", 1), ("notification_type", 1)],
            unique=True,
            sparse=True,
        )
        mongo_db.medication_notifications.create_index(
            [("recipient_nurse_id", 1), ("read", 1)]
        )
        mongo_db.medication_notifications.create_index(
            [("scheduled_datetime", 1)]
        )
    except Exception as err:
        print("Notification index initialization warning:", err)


def resolve_patient_nurse(patient_id: int) -> Tuple[Optional[int], Optional[str], bool]:
    """
    Dynamically resolve the nurse currently authorized and actively assigned
    to the given patient via nurse_patient_assignments.
    If no active nurse is assigned, flags as a supervisor/head nurse alert.
    """
    assignment = mongo_db.nurse_patient_assignments.find_one({
        "patient_id": int(patient_id),
        "is_active": {"$in": [1, True]},
    })

    if not assignment:
        return None, None, True

    nurse_id = int(assignment["nurse_id"])
    nurse = mongo_db.users.find_one({"_id": nurse_id, "is_active": {"$in": [1, True]}})
    if not nurse:
        return None, None, True

    nurse_name = nurse.get("full_name") or nurse.get("username") or f"Nurse #{nurse_id}"
    return nurse_id, nurse_name, False


def create_notification_jobs_for_schedules(
    schedules: List[Dict[str, Any]],
    patient: Dict[str, Any],
    ward_name: Optional[str] = None,
    bed_number: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Create and persist 5-minute pre-dose medication notification records in MongoDB.
    """
    created_notifications = []
    patient_id = int(patient.get("id", patient.get("_id")))
    patient_name = (
        patient.get("full_name")
        or f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()
        or "Inpatient"
    )
    patient_code = patient.get("patient_id", f"PAT-{patient_id}")

    # Build ward / bed string
    w_name = ward_name or patient.get("ward_name") or ""
    b_num = bed_number or patient.get("bed_number") or ""
    if not w_name and patient.get("ward_id"):
        w_doc = mongo_db.wards.find_one({"_id": patient["ward_id"]})
        if w_doc:
            w_name = w_doc.get("name", "")
    if not b_num and patient.get("bed_id"):
        b_doc = mongo_db.beds.find_one({"_id": patient["bed_id"]})
        if b_doc:
            b_num = str(b_doc.get("bed_number", ""))

    ward_bed_str = f"{w_name} / Bed {b_num}".strip(" /") if (w_name or b_num) else "Inpatient Ward"

    now_iso = datetime.now(timezone.utc).isoformat()

    for schedule in schedules:
        schedule_id = int(schedule.get("id", schedule.get("_id")))
        scheduled_date_str = str(schedule.get("scheduled_date", "")).split("T")[0]
        scheduled_time_str = str(schedule.get("scheduled_time", "")).split(".")[0]
        if len(scheduled_time_str) == 5:
            scheduled_time_str += ":00"

        try:
            scheduled_dt = datetime.strptime(
                f"{scheduled_date_str} {scheduled_time_str}",
                "%Y-%m-%d %H:%M:%S",
            )
        except Exception:
            continue

        notification_dt = scheduled_dt - timedelta(minutes=5)
        notification_time_iso = notification_dt.isoformat()
        scheduled_time_iso = scheduled_dt.isoformat()

        # Idempotent check
        existing = mongo_db.medication_notifications.find_one({
            "medication_schedule_id": schedule_id,
            "notification_type": "MEDICATION_REMINDER",
        })
        if existing:
            continue

        # Resolve initial active nurse
        nurse_id, nurse_name, is_sup_alert = resolve_patient_nurse(patient_id)

        notif_id = next_mongo_id("medication_notifications")
        notif_doc = {
            "_id": notif_id,
            "id": notif_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "patient_code": patient_code,
            "ward_name": w_name,
            "bed_number": b_num,
            "ward_bed": ward_bed_str,
            "prescription_id": schedule.get("prescription_id"),
            "prescription_item_id": schedule.get("prescription_item_id"),
            "medication_schedule_id": schedule_id,
            "medicine_id": schedule.get("medicine_id"),
            "medicine_name": schedule.get("medicine_name", "Medication"),
            "dose": schedule.get("dose", ""),
            "route": schedule.get("route", "Oral"),
            "is_stat": bool(schedule.get("is_stat", False)),
            "instructions": schedule.get("instructions"),
            "scheduled_date": scheduled_date_str,
            "scheduled_time": scheduled_time_str,
            "scheduled_datetime": scheduled_time_iso,
            "notification_time": notification_time_iso,
            "recipient_nurse_id": nurse_id,
            "recipient_nurse_name": nurse_name,
            "is_supervisor_alert": is_sup_alert,
            "notification_type": "MEDICATION_REMINDER",
            "message": "Medication administration is due in 5 minutes.",
            "delivery_status": "PENDING",
            "read": False,
            "read_at": None,
            "acknowledged": False,
            "acknowledged_at": None,
            "acknowledged_by": None,
            "acknowledged_by_name": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        try:
            mongo_db.medication_notifications.insert_one(notif_doc)
            created_notifications.append(notif_doc)
        except Exception:
            # Handle unique index race condition cleanly
            pass

    return created_notifications


def process_due_notifications(as_of_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """
    Process, refresh shift assignments, and deliver all notifications that are due
    (i.e. scheduled_time - 5 minutes <= as_of_time).

    Guarantees:
    - Never delivers for cancelled, held, administered schedules, or discharged patients.
    - Dynamically rechecks nurse assignment: if Nurse A's shift ended and Nurse B is now assigned,
      Nurse B is the recipient, and Nurse A will not see it.
    - If no nurse is assigned, converts to Head Nurse / Supervisor alert.
    """
    now = as_of_time or datetime.now()
    now_iso = now.isoformat()
    now_utc_str = datetime.now(timezone.utc).isoformat()

    # Query all unadministered schedules
    candidate_schedules = list(mongo_db.medication_schedules.find({
        "status": {"$in": ["SCHEDULED", "UPCOMING", "DUE", "OVERDUE"]},
        "actual_administration_time": {"$in": [None, ""]},
    }))

    delivered = []

    for schedule in candidate_schedules:
        schedule_id = int(schedule.get("id", schedule.get("_id")))
        scheduled_date_str = str(schedule.get("scheduled_date", "")).split("T")[0]
        scheduled_time_str = str(schedule.get("scheduled_time", "")).split(".")[0]
        if len(scheduled_time_str) == 5:
            scheduled_time_str += ":00"

        try:
            scheduled_dt = datetime.strptime(
                f"{scheduled_date_str} {scheduled_time_str}",
                "%Y-%m-%d %H:%M:%S",
            )
        except Exception:
            continue

        notification_dt = scheduled_dt - timedelta(minutes=5)

        # Check if notification is due as of the evaluation clock
        if notification_dt > now:
            continue

        # Check patient status: if discharged or inactive, do not send
        patient_id = schedule.get("patient_id")
        if not patient_id:
            # Fallback lookup from item/prescription
            item = mongo_db.prescription_items.find_one({"_id": schedule.get("prescription_item_id")})
            if item:
                rx = mongo_db.prescriptions.find_one({"_id": item.get("prescription_id")})
                if rx:
                    patient_id = rx.get("patient_id")

        if not patient_id:
            continue

        patient = mongo_db.patients.find_one({"$or": [{"_id": patient_id}, {"id": patient_id}]})
        if (
            not patient
            or not patient.get("is_active")
            or patient.get("lifecycle_status") == "DISCHARGED"
        ):
            # Suppress notification for discharged patient
            continue

        # Re-verify prescription is still active
        rx_id = schedule.get("prescription_id")
        if rx_id:
            prescription = mongo_db.prescriptions.find_one({"_id": rx_id})
            if prescription and prescription.get("status") in {"DISCHARGED", "CANCELLED", "STOPPED"}:
                continue

        # Dynamically resolve current assigned nurse at notification time
        nurse_id, nurse_name, is_sup_alert = resolve_patient_nurse(int(patient_id))

        # Check if notification record exists
        existing = mongo_db.medication_notifications.find_one({
            "medication_schedule_id": schedule_id,
            "notification_type": "MEDICATION_REMINDER",
        })

        if existing:
            # Update dynamic recipient (in case shift/assignment changed since creation)
            update_fields = {
                "delivery_status": "DELIVERED",
                "recipient_nurse_id": nurse_id,
                "recipient_nurse_name": nurse_name,
                "is_supervisor_alert": is_sup_alert,
                "updated_at": now_utc_str,
            }
            mongo_db.medication_notifications.update_one(
                {"_id": existing["_id"]},
                {"$set": update_fields},
            )
            existing.update(update_fields)
            delivered.append(existing)
        else:
            # Create fresh delivered record
            patient_name = (
                patient.get("full_name")
                or f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()
                or "Inpatient"
            )
            patient_code = patient.get("patient_id", f"PAT-{patient_id}")
            w_name = patient.get("ward_name") or ""
            b_num = str(patient.get("bed_number") or "")
            ward_bed_str = f"{w_name} / Bed {b_num}".strip(" /") or "Inpatient Ward"

            notif_id = next_mongo_id("medication_notifications")
            new_doc = {
                "_id": notif_id,
                "id": notif_id,
                "patient_id": int(patient_id),
                "patient_name": patient_name,
                "patient_code": patient_code,
                "ward_name": w_name,
                "bed_number": b_num,
                "ward_bed": ward_bed_str,
                "prescription_id": schedule.get("prescription_id"),
                "prescription_item_id": schedule.get("prescription_item_id"),
                "medication_schedule_id": schedule_id,
                "medicine_id": schedule.get("medicine_id"),
                "medicine_name": schedule.get("medicine_name", "Medication"),
                "dose": schedule.get("dose", ""),
                "route": schedule.get("route", "Oral"),
                "is_stat": bool(schedule.get("is_stat", False)),
                "instructions": schedule.get("instructions"),
                "scheduled_date": scheduled_date_str,
                "scheduled_time": scheduled_time_str,
                "scheduled_datetime": scheduled_dt.isoformat(),
                "notification_time": notification_dt.isoformat(),
                "recipient_nurse_id": nurse_id,
                "recipient_nurse_name": nurse_name,
                "is_supervisor_alert": is_sup_alert,
                "notification_type": "MEDICATION_REMINDER",
                "message": "Medication administration is due in 5 minutes.",
                "delivery_status": "DELIVERED",
                "read": False,
                "read_at": None,
                "acknowledged": False,
                "acknowledged_at": None,
                "acknowledged_by": None,
                "acknowledged_by_name": None,
                "created_at": now_utc_str,
                "updated_at": now_utc_str,
            }
            mongo_db.medication_notifications.insert_one(new_doc)
            delivered.append(new_doc)

    return delivered


def get_nurse_notifications(
    nurse_id: int,
    is_supervisor: bool = False,
    unread_only: bool = False,
    limit: int = 50,
    as_of_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch active delivered notifications for a nurse.
    - Filters strictly to patients currently assigned to this nurse.
    - If supervisor, includes unassigned alerts.
    - Excludes discharged patients and already administered/cancelled doses.
    """
    process_due_notifications(as_of_time=as_of_time)

    # Base query for delivered notifications
    query: Dict[str, Any] = {"delivery_status": "DELIVERED"}

    if is_supervisor:
        query["$or"] = [
            {"recipient_nurse_id": int(nurse_id)},
            {"is_supervisor_alert": True},
        ]
    else:
        query["recipient_nurse_id"] = int(nurse_id)

    if unread_only:
        query["read"] = False

    raw_list = list(
        mongo_db.medication_notifications.find(query)
        .sort([("scheduled_datetime", 1), ("notification_time", -1)])
        .limit(limit)
    )

    clean_results = []
    for item in raw_list:
        item["id"] = int(item.get("id", item.get("_id")))
        if "_id" in item:
            item["_id"] = str(item["_id"])
        clean_results.append(item)

    return clean_results


def acknowledge_notification(notification_id: int, user: Any) -> Dict[str, Any]:
    """
    Acknowledge a medication reminder.
    IMPORTANT: Acknowledging a reminder NEVER counts as medicine administration!
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    user_name = getattr(user, "full_name", None) or getattr(user, "username", f"User #{user.id}")

    updated = mongo_db.medication_notifications.find_one_and_update(
        {"$or": [{"_id": int(notification_id)}, {"id": int(notification_id)}]},
        {
            "$set": {
                "acknowledged": True,
                "read": True,
                "acknowledged_at": now_iso,
                "acknowledged_by": int(user.id),
                "acknowledged_by_name": user_name,
                "updated_at": now_iso,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if not updated:
        return {"error": "Notification not found."}

    updated["id"] = int(updated.get("id", updated.get("_id")))
    if "_id" in updated:
        updated["_id"] = str(updated["_id"])

    return updated

