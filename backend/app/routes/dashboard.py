from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db

from app.models import (
    AIPrediction,
    MedicationAdministration,
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    User,
)

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

def schedule_status_counts(db: Session):
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
        result[status.lower()] = int(
            db.scalar(
                select(
                    func.count(
                        MedicationSchedule.id
                    )
                ).where(
                    MedicationSchedule.status
                    == status
                )
            )
            or 0
        )

    return result


# =========================================================
# Medication Summary
# =========================================================

@router.get("/medication-summary")
def get_medication_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return medication monitoring statistics.

    Counts are calculated from medication schedule
    records in the database.
    """

    total = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            )
        )
        or 0
    )


    counts = schedule_status_counts(db)


    today = date.today()


    today_total = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            ).where(
                MedicationSchedule.scheduled_date
                == today
            )
        )
        or 0
    )


    today_given = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            ).where(
                MedicationSchedule.scheduled_date
                == today,
                MedicationSchedule.status
                == "GIVEN",
            )
        )
        or 0
    )


    today_upcoming = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            ).where(
                MedicationSchedule.scheduled_date
                == today,
                MedicationSchedule.status
                == "UPCOMING",
            )
        )
        or 0
    )


    today_delayed = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            ).where(
                MedicationSchedule.scheduled_date
                == today,
                MedicationSchedule.status
                == "DELAYED",
            )
        )
        or 0
    )


    stat = int(
        db.scalar(
            select(
                func.count(
                    MedicationSchedule.id
                )
            )
            .join(
                MedicationSchedule.prescription_item
            )
            .where(
                MedicationSchedule.prescription_item.has(
                    is_stat=True
                )
            )
        )
        or 0
    )


    ai_high_risk = int(
        db.scalar(
            select(
                func.count(
                    AIPrediction.id
                )
            ).where(
                (
                    AIPrediction.delay_risk_level
                    == "HIGH"
                )
                |
                (
                    AIPrediction.missed_risk_level
                    == "HIGH"
                )
            )
        )
        or 0
    )


    return {
        "message": (
            "Medication monitoring summary "
            "generated successfully."
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

@router.get(
    "/monitoring/schedules"
)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return detailed medication schedules
    with patient, medicine, prescription,
    and administration information.
    """

    query = (
        select(
            MedicationSchedule.id.label(
                "schedule_id"
            ),

            MedicationSchedule.scheduled_date,

            MedicationSchedule.scheduled_time,

            MedicationSchedule.status,

            MedicationSchedule.actual_administration_time,

            MedicationSchedule.administered_by,

            MedicationSchedule.notes,

            Prescription.id.label(
                "prescription_id"
            ),

            Prescription.patient_id,

            Prescription.doctor_id,

            Prescription.status.label(
                "prescription_status"
            ),

            PrescriptionItem.id.label(
                "prescription_item_id"
            ),

            PrescriptionItem.dose,

            PrescriptionItem.route,

            PrescriptionItem.frequency,

            PrescriptionItem.duration_days,

            PrescriptionItem.is_stat,

            PrescriptionItem.instructions,

            Medicine.id.label(
                "medicine_id"
            ),

            Medicine.name.label(
                "medicine_name"
            ),

            Medicine.generic_name.label(
                "generic_name"
            ),

            Medicine.strength.label(
                "medicine_strength"
            ),

            Patient.patient_id.label(
                "patient_code"
            ),

            Patient.first_name,

            Patient.last_name,

            User.username.label(
                "administered_by_username"
            ),
        )
        .join(
            PrescriptionItem,
            MedicationSchedule.prescription_item_id
            == PrescriptionItem.id,
        )
        .join(
            Prescription,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .join(
            Medicine,
            PrescriptionItem.medicine_id
            == Medicine.id,
        )
        .join(
            Patient,
            Prescription.patient_id
            == Patient.id,
        )
        .outerjoin(
            User,
            MedicationSchedule.administered_by
            == User.id,
        )
    )


    if status:
        query = query.where(
            MedicationSchedule.status
            == status.upper().strip()
        )


    query = (
        query
        .order_by(
            MedicationSchedule.scheduled_date.desc(),
            MedicationSchedule.scheduled_time.desc(),
            MedicationSchedule.id.desc(),
        )
        .limit(limit)
    )


    rows = db.execute(query).all()


    return {
        "count": len(rows),

        "schedules": [
            {
                "schedule_id":
                    row.schedule_id,

                "scheduled_date":
                    row.scheduled_date,

                "scheduled_time":
                    row.scheduled_time,

                "status":
                    row.status,

                "actual_administration_time":
                    row.actual_administration_time,

                "administered_by":
                    row.administered_by,

                "administered_by_username":
                    row.administered_by_username,

                "notes":
                    row.notes,

                "prescription_id":
                    row.prescription_id,

                "prescription_item_id":
                    row.prescription_item_id,

                "prescription_status":
                    row.prescription_status,

                "patient_id":
                    row.patient_id,

                "patient_code":
                    row.patient_code,

                "patient_name":
                    (
                        f"{row.first_name} "
                        f"{row.last_name}"
                    ),

                "doctor_id":
                    row.doctor_id,

                "medicine_id":
                    row.medicine_id,

                "medicine_name":
                    row.medicine_name,

                "generic_name":
                    row.generic_name,

                "medicine_strength":
                    row.medicine_strength,

                "dose":
                    row.dose,

                "route":
                    row.route,

                "frequency":
                    row.frequency,

                "duration_days":
                    row.duration_days,

                "is_stat":
                    row.is_stat,

                "instructions":
                    row.instructions,
            }
            for row in rows
        ],
    }


# =========================================================
# AI Monitoring
# =========================================================

@router.get(
    "/monitoring/ai"
)
def get_ai_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return recent AI medication risk predictions.
    """

    rows = db.execute(
        select(
            AIPrediction,

            MedicationSchedule.scheduled_date,

            MedicationSchedule.scheduled_time,

            Patient.patient_id.label(
                "patient_code"
            ),

            Patient.first_name,

            Patient.last_name,

            Medicine.name.label(
                "medicine_name"
            ),
        )
        .join(
            MedicationSchedule,
            AIPrediction.medication_schedule_id
            == MedicationSchedule.id,
        )
        .join(
            PrescriptionItem,
            MedicationSchedule.prescription_item_id
            == PrescriptionItem.id,
        )
        .join(
            Prescription,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .join(
            Patient,
            Prescription.patient_id
            == Patient.id,
        )
        .join(
            Medicine,
            PrescriptionItem.medicine_id
            == Medicine.id,
        )
        .order_by(
            AIPrediction.id.desc()
        )
        .limit(limit)
    ).all()


    high = 0
    medium = 0
    low = 0


    predictions = []


    for row in rows:

        ai = row[0]


        levels = [
            ai.delay_risk_level,
            ai.missed_risk_level,
        ]


        if "HIGH" in levels:
            high += 1

        elif "MEDIUM" in levels:
            medium += 1

        else:
            low += 1


        predictions.append(
            {
                "prediction_id":
                    ai.id,

                "schedule_id":
                    ai.medication_schedule_id,

                "patient_code":
                    row.patient_code,

                "patient_name":
                    (
                        f"{row.first_name} "
                        f"{row.last_name}"
                    ),

                "medicine_name":
                    row.medicine_name,

                "scheduled_date":
                    row.scheduled_date,

                "scheduled_time":
                    row.scheduled_time,

                "delay_probability":
                    ai.delay_probability,

                "delay_risk_percent":
                    round(
                        ai.delay_probability * 100,
                        2,
                    ),

                "delay_risk_level":
                    ai.delay_risk_level,

                "missed_probability":
                    ai.missed_probability,

                "missed_risk_percent":
                    round(
                        ai.missed_probability * 100,
                        2,
                    ),

                "missed_risk_level":
                    ai.missed_risk_level,
            }
        )


    return {
        "count":
            len(predictions),

        "risk_summary": {
            "high":
                high,
            "medium":
                medium,
            "low":
                low,
        },

        "predictions":
            predictions,
    }


# =========================================================
# Administration Monitoring
# =========================================================

@router.get(
    "/monitoring/administrations"
)
def get_administration_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Return detailed medication administration audit data.
    """

    rows = db.execute(
        select(
            MedicationAdministration,

            MedicationSchedule.scheduled_date,

            MedicationSchedule.scheduled_time,

            Patient.patient_id.label(
                "patient_code"
            ),

            Patient.first_name,

            Patient.last_name,

            Medicine.name.label(
                "medicine_name"
            ),

            User.username.label(
                "administered_by_username"
            ),
        )
        .join(
            MedicationSchedule,
            MedicationAdministration.medication_schedule_id
            == MedicationSchedule.id,
        )
        .join(
            PrescriptionItem,
            MedicationSchedule.prescription_item_id
            == PrescriptionItem.id,
        )
        .join(
            Prescription,
            PrescriptionItem.prescription_id
            == Prescription.id,
        )
        .join(
            Patient,
            Prescription.patient_id
            == Patient.id,
        )
        .join(
            Medicine,
            PrescriptionItem.medicine_id
            == Medicine.id,
        )
        .outerjoin(
            User,
            MedicationAdministration.administered_by
            == User.id,
        )
        .order_by(
            MedicationAdministration.id.desc()
        )
        .limit(limit)
    ).all()


    return {
        "count":
            len(rows),

        "administrations": [
            {
                "administration_id":
                    row[0].id,

                "schedule_id":
                    row[0].medication_schedule_id,

                "status":
                    row[0].status,

                "administered_by":
                    row[0].administered_by,

                "administered_by_username":
                    row.administered_by_username,

                "administered_at":
                    row[0].administered_at,

                "notes":
                    row[0].notes,

                "scheduled_date":
                    row.scheduled_date,

                "scheduled_time":
                    row.scheduled_time,

                "patient_code":
                    row.patient_code,

                "patient_name":
                    (
                        f"{row.first_name} "
                        f"{row.last_name}"
                    ),

                "medicine_name":
                    row.medicine_name,
            }
            for row in rows
        ],
    }


# =========================================================
# Safety Monitoring
# =========================================================

@router.get(
    "/monitoring/safety"
)
def get_safety_monitoring(
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "VIEW_MEDICATION_SCHEDULE"
        )
    ),
):
    """
    Run safety checks for medication schedules
    and return the results for monitoring.

    Safety results are computed from current clinical
    data rather than read from a separate fake table.
    """

    schedule_ids = db.scalars(
        select(MedicationSchedule.id)
        .order_by(
            MedicationSchedule.id.desc()
        )
        .limit(limit)
    ).all()


    results = []

    safe_count = 0
    warning_count = 0
    critical_count = 0


    for schedule_id in schedule_ids:

        try:

            result = check_medication_safety(
                db=db,
                schedule_id=schedule_id,
            )


            results.append(result)


            if result.get("safe"):
                safe_count += 1

            else:

                severity = str(
                    result.get(
                        "severity",
                        ""
                    )
                ).upper()


                if severity in {
                    "HIGH",
                    "CRITICAL",
                    "SEVERE",
                }:
                    critical_count += 1

                else:
                    warning_count += 1


        except ValueError:
            continue


    return {
        "count":
            len(results),

        "summary": {
            "safe":
                safe_count,

            "warnings":
                warning_count,

            "critical":
                critical_count,
        },

        "checks":
            results,
    }