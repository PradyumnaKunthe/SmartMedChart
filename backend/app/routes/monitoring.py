from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from app.mongo_client import mongo_db
from app.schemas.administration import MedicationAlertAcknowledgeRequest
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
@router.get("/alerts")
def get_alerts(
    acknowledged: Optional[bool] = Query(False, description="Filter acknowledged alerts"),
    current_user=Depends(get_current_user),
):
    """
    Retrieve overdue and missed medication alerts.
    """
    sync_medication_alerts()

    query = {}
    if acknowledged is not None:
        query["is_acknowledged"] = acknowledged

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
    """
    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", f"User #{current_user.id}")
    now_iso = datetime.now(timezone.utc).isoformat()

    updated = mongo_db.medication_alerts.find_one_and_update(
        {"$or": [{"_id": alert_id}, {"id": alert_id}]},
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
    policy_update: dict,
    current_user=Depends(require_permission("MANAGE_SYSTEM")),
):
    """Update hospital administration window policy."""
    return set_hospital_policy(policy_update)
