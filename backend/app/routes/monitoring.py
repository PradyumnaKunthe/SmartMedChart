from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from app.mongo_client import mongo_db
from app.schemas.administration import (
    HospitalPolicyUpdateRequest,
    MedicationAlertAcknowledgeRequest,
)
from app.security import require_permission, get_current_user
from app.services.medication_monitoring_service import (
    get_hospital_policy,
    set_hospital_policy,
    get_monitoring_dashboard,
    get_compliance_reports,
    sync_medication_alerts,
)


router = APIRouter(prefix="/api/monitoring", tags=["Medication Monitoring"])


# =========================================================
# MONITORING DASHBOARD (METRICS & FILTERABLE ROSTER)
# =========================================================
@router.get("/dashboard")
def get_dashboard_data(
    date: Optional[str] = Query(None, description="Date filter YYYY-MM-DD"),
    patient: Optional[str] = Query(None, description="Patient name or code filter"),
    ward: Optional[str] = Query(None, description="Ward name or ID filter"),
    nurse: Optional[str] = Query(None, description="Nurse name or ID filter"),
    status: Optional[str] = Query(None, description="Monitoring status filter"),
    current_user=Depends(require_permission("VIEW_REPORTS")),
):
    """
    Retrieve real-time medication administration monitoring statistics,
    delay calculations, nurse accountability records, and overdue alerts.
    """
    try:
        return get_monitoring_dashboard(
            date_filter=date,
            patient_filter=patient,
            ward_filter=ward,
            nurse_filter=nurse,
            status_filter=status,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate monitoring dashboard: {str(exc)}",
        ) from exc


# =========================================================
# COMPLIANCE & QUALITY REPORTS
# =========================================================
@router.get("/reports")
def get_reports(
    current_user=Depends(require_permission("VIEW_REPORTS")),
):
    """
    Generate auditable reports for on-time administration %, delays,
    missed doses, and compliance breakdown by nurse and ward.
    """
    try:
        return get_compliance_reports()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate compliance reports: {str(exc)}",
        ) from exc


# =========================================================
# ALERTS & NOTIFICATIONS
# =========================================================

def is_admin_user(user) -> bool:
    """Check if the user has administrative / supervisory privileges."""
    role = getattr(user, "role", None)
    if isinstance(role, str) and role.lower() in ("admin", "administrator"):
        return True
    if role and getattr(role, "name", "").lower() in ("admin", "administrator"):
        return True
    permissions = getattr(user, "permissions", None)
    if permissions and ("MANAGE_SYSTEM" in permissions or "VIEW_REPORTS" in permissions):
        return True
    if role and hasattr(role, "permissions"):
        perm_names = {getattr(p, "name", str(p)) for p in role.permissions}
        if "MANAGE_SYSTEM" in perm_names or "VIEW_REPORTS" in perm_names:
            return True
    return False


def get_user_role_name(user) -> str:
    """Extract lowercased role name from user context."""
    role = getattr(user, "role", None)
    if isinstance(role, str):
        return role.lower()
    if role and hasattr(role, "name"):
        return getattr(role, "name", "").lower()
    return (getattr(user, "role_name", "") or "").lower()


@router.get("/alerts")
def get_alerts(
    acknowledged: Optional[bool] = Query(False, description="Filter acknowledged alerts"),
    current_user=Depends(get_current_user),
):
    """
    Retrieve overdue and missed medication alerts.
    Enforces role-based clinical scoping:
    - Receptionist / Pharmacist: Denied (403 Forbidden)
    - Admin: All hospital alerts
    - Nurse: Alerts for assigned patients (or explicitly assigned in alert)
    - Doctor: Alerts for assigned encounter/prescription patients
    """
    if hasattr(acknowledged, "default"):
        acknowledged = acknowledged.default

    role_name = get_user_role_name(current_user)

    if role_name in ("receptionist", "pharmacist"):
        raise HTTPException(
            status_code=403,
            detail="Access to clinical medication alerts is restricted to authorized clinical staff.",
        )

    sync_medication_alerts()

    query: dict = {}
    if acknowledged is not None:
        query["is_acknowledged"] = acknowledged

    user_id = current_user.id
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        user_id_int = user_id

    if is_admin_user(current_user):
        pass  # Full visibility for administrators / supervisors
    elif role_name == "nurse" or (
        hasattr(current_user, "role")
        and hasattr(current_user.role, "permissions")
        and any(
            getattr(p, "name", "") in ("ADMINISTER_MEDICATION", "VERIFY_QR")
            for p in current_user.role.permissions
        )
    ):
        assignments = list(mongo_db.nurse_patient_assignments.find({
            "nurse_id": {"$in": [user_id, str(user_id), user_id_int]},
            "is_active": {"$in": [1, True, "1", "true"]}
        }))
        assigned_pids = []
        for a in assignments:
            p = a.get("patient_id")
            if p is not None:
                assigned_pids.extend([p, str(p)])
                try:
                    assigned_pids.append(int(p))
                except (ValueError, TypeError):
                    pass

        scope_filter = [
            {"assigned_nurse_ids": {"$in": [user_id, str(user_id), user_id_int]}}
        ]
        if assigned_pids:
            scope_filter.append({"patient_id": {"$in": list(set(assigned_pids))}})

        query["$or"] = scope_filter

    elif role_name == "doctor" or (
        hasattr(current_user, "role")
        and hasattr(current_user.role, "permissions")
        and any(
            getattr(p, "name", "") in ("CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION")
            for p in current_user.role.permissions
        )
    ):
        encounters = list(mongo_db.encounters.find({
            "doctor_id": {"$in": [user_id, str(user_id), user_id_int]},
            "status": "ACTIVE"
        }))
        doc_pids = []
        for e in encounters:
            p = e.get("patient_id")
            if p is not None:
                doc_pids.extend([p, str(p)])
                try:
                    doc_pids.append(int(p))
                except (ValueError, TypeError):
                    pass

        rx_pids = mongo_db.prescriptions.distinct("patient_id", {
            "doctor_id": {"$in": [user_id, str(user_id), user_id_int]},
            "status": "ACTIVE"
        })
        for p in rx_pids:
            if p is not None:
                doc_pids.extend([p, str(p)])
                try:
                    doc_pids.append(int(p))
                except (ValueError, TypeError):
                    pass

        query["patient_id"] = {"$in": list(set(doc_pids))}
    else:
        raise HTTPException(
            status_code=403,
            detail="Access to clinical medication alerts is restricted to authorized clinical staff.",
        )

    alerts = list(
        mongo_db.medication_alerts.find(query).sort([("created_at", -1)]).limit(100)
    )

    for a in alerts:
        a["id"] = a.get("id", a.get("_id"))
        if "_id" in a:
            a["_id"] = str(a["_id"])

    return alerts


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    request: MedicationAlertAcknowledgeRequest,
    current_user=Depends(get_current_user),
):
    """
    Acknowledge an overdue or missed medication alert.
    Enforces role-based clinical authorization:
    - Receptionist / Pharmacist: Denied (403 Forbidden)
    - Admin: Authorized
    - Nurse: Must be assigned to the patient or listed in assigned_nurse_ids
    - Doctor: Must be attending physician (active encounter or active prescription)
    """
    role_name = get_user_role_name(current_user)

    if role_name in ("receptionist", "pharmacist"):
        raise HTTPException(
            status_code=403,
            detail="Access to clinical medication alerts is restricted to authorized clinical staff.",
        )

    alert = mongo_db.medication_alerts.find_one({
        "$or": [{"_id": alert_id}, {"id": alert_id}]
    })

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    if alert.get("is_acknowledged"):
        return {
            "message": "Alert has already been acknowledged.",
            "alert": alert,
        }

    user_id = current_user.id
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        user_id_int = user_id

    patient_id = alert.get("patient_id")

    # Authorization verification
    if is_admin_user(current_user):
        pass  # Admin authorized
    elif role_name == "nurse" or (
        hasattr(current_user, "role")
        and hasattr(current_user.role, "permissions")
        and any(
            getattr(p, "name", "") in ("ADMINISTER_MEDICATION", "VERIFY_QR")
            for p in current_user.role.permissions
        )
    ):
        assigned_nurse_ids = [str(x) for x in alert.get("assigned_nurse_ids", [])]
        is_assigned = str(user_id) in assigned_nurse_ids

        if not is_assigned and patient_id is not None:
            assignment = mongo_db.nurse_patient_assignments.find_one({
                "nurse_id": {"$in": [user_id, str(user_id), user_id_int]},
                "patient_id": {"$in": [patient_id, str(patient_id), int(patient_id) if str(patient_id).isdigit() else patient_id]},
                "is_active": {"$in": [1, True, "1", "true"]}
            })
            if assignment:
                is_assigned = True

        if not is_assigned:
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to acknowledge alerts for this patient. Only assigned nurses or attending physicians may acknowledge medication alerts."
            )
    elif role_name == "doctor" or (
        hasattr(current_user, "role")
        and hasattr(current_user.role, "permissions")
        and any(
            getattr(p, "name", "") in ("CREATE_PRESCRIPTION", "EDIT_PRESCRIPTION")
            for p in current_user.role.permissions
        )
    ):
        is_assigned = False
        if patient_id is not None:
            encounter = mongo_db.encounters.find_one({
                "doctor_id": {"$in": [user_id, str(user_id), user_id_int]},
                "patient_id": {"$in": [patient_id, str(patient_id), int(patient_id) if str(patient_id).isdigit() else patient_id]},
                "status": "ACTIVE"
            })
            if encounter:
                is_assigned = True
            else:
                rx = mongo_db.prescriptions.find_one({
                    "doctor_id": {"$in": [user_id, str(user_id), user_id_int]},
                    "patient_id": {"$in": [patient_id, str(patient_id), int(patient_id) if str(patient_id).isdigit() else patient_id]},
                    "status": "ACTIVE"
                })
                if rx:
                    is_assigned = True

        if not is_assigned:
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to acknowledge alerts for this patient. Only assigned nurses or attending physicians may acknowledge medication alerts."
            )
    else:
        raise HTTPException(
            status_code=403,
            detail="Access to clinical medication alerts is restricted to authorized clinical staff.",
        )

    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", f"User #{current_user.id}")
    now_iso = datetime.now(timezone.utc).isoformat()
    actual_alert_id = alert.get("_id", alert_id)

    updated = mongo_db.medication_alerts.find_one_and_update(
        {"_id": actual_alert_id},
        {
            "$set": {
                "is_acknowledged": True,
                "acknowledged_by": int(current_user.id),
                "acknowledged_by_name": user_name,
                "acknowledged_at": now_iso,
                "acknowledgement_note": request.acknowledgement_note,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found.")

    updated["id"] = updated.get("id", updated.get("_id"))
    if "_id" in updated:
        updated["_id"] = str(updated["_id"])

    return {
        "message": "Alert acknowledged successfully.",
        "alert": updated,
    }


# =========================================================
# HOSPITAL POLICY CONFIGURATION
# =========================================================
@router.get("/policy")
def get_policy(
    current_user=Depends(get_current_user),
):
    """Retrieve hospital administration window policy."""
    return get_hospital_policy()


@router.put("/policy")
def update_policy(
    policy_update: HospitalPolicyUpdateRequest,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    """Update hospital administration window policy."""
    return set_hospital_policy(policy_update)
