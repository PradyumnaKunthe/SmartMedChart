from datetime import datetime

from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session

from app.models import (
    MedicationSchedule,
    Medicine,
    Patient,
    Prescription,
    PrescriptionItem,
    Ward,
)


def build_medication_features(
    db: Session,
    schedule_id: int,
) -> dict:
    """
    Build AI features from a real SmartMedChart
    medication schedule.

    Features that are available from the current database
    are calculated from real records.

    Because the current database does not yet have real ward
    assignments or nurse assignment/workload data, the ward
    delay rate is currently a global medication delay rate,
    and nurse_workload is a medication-schedule workload proxy.
    """

    # =====================================================
    # 1. Load schedule and related records
    # =====================================================

    row = db.execute(
        select(
            MedicationSchedule,
            PrescriptionItem,
            Prescription,
            Patient,
            Medicine,
            Ward,
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .join(
            Patient,
            Patient.id
            == Prescription.patient_id,
        )
        .join(
            Medicine,
            Medicine.id
            == PrescriptionItem.medicine_id,
        )
        .outerjoin(
            Ward,
            Ward.id
            == Patient.ward_id,
        )
        .where(
            MedicationSchedule.id
            == schedule_id,
        )
    ).first()

    if row is None:
        raise ValueError(
            "Medication schedule not found."
        )

    (
        schedule,
        item,
        prescription,
        patient,
        medicine,
        ward,
    ) = row

    # =====================================================
    # 2. Scheduled date and time features
    # =====================================================

    scheduled_datetime = datetime.combine(
        schedule.scheduled_date,
        schedule.scheduled_time,
    )

    scheduled_hour = (
        scheduled_datetime.hour
    )

    day_of_week = (
        scheduled_datetime.weekday()
    )

    # =====================================================
    # 3. Frequency -> doses per day
    # =====================================================

    frequency_per_day_map = {
        "ONCE_DAILY": 1,
        "TWICE_DAILY": 2,
        "EVERY_8_HOURS": 3,
        "EVERY_6_HOURS": 4,
    }

    frequency_per_day = (
        frequency_per_day_map.get(
            item.frequency,
            1,
        )
    )

    # =====================================================
    # 4. Number of active medications for this patient
    # =====================================================

    active_medications = db.scalar(
        select(
            func.count(PrescriptionItem.id)
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id
            == prescription.patient_id,
            Prescription.status == "ACTIVE",
            PrescriptionItem.status == "ACTIVE",
        )
    ) or 0

    # =====================================================
    # 5. Previous delayed doses for this patient
    # =====================================================

    previous_delays = db.scalar(
        select(
            func.count(MedicationSchedule.id)
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id
            == prescription.patient_id,
            MedicationSchedule.status == "DELAYED",
            MedicationSchedule.id != schedule_id,
        )
    ) or 0

    # =====================================================
    # 6. Previous missed doses for this patient
    # =====================================================

    previous_missed = db.scalar(
        select(
            func.count(MedicationSchedule.id)
        )
        .join(
            PrescriptionItem,
            PrescriptionItem.id
            == MedicationSchedule.prescription_item_id,
        )
        .join(
            Prescription,
            Prescription.id
            == PrescriptionItem.prescription_id,
        )
        .where(
            Prescription.patient_id
            == prescription.patient_id,
            MedicationSchedule.status == "NOT_GIVEN",
            MedicationSchedule.id != schedule_id,
        )
    ) or 0

    # =====================================================
    # 7. Ward name
    # =====================================================

    ward_name = (
        ward.name
        if ward is not None and ward.name
        else "General"
    )

    # =====================================================
    # 8. Calculate GLOBAL historical delay rate
    # =====================================================
    #
    # A true ward-specific rate is not possible yet because
    # the current database has no actual Ward records and
    # patients currently have ward_id = NULL.
    #
    # Therefore this is a global rate used as a temporary
    # proxy for the model's ward_delay_rate feature.
    # =====================================================

    completed_statuses = [
        "GIVEN",
        "DELAYED",
        "HELD",
        "REFUSED",
        "NOT_GIVEN",
    ]

    total_completed = db.scalar(
        select(
            func.count(MedicationSchedule.id)
        ).where(
            MedicationSchedule.status.in_(
                completed_statuses
            )
        )
    ) or 0

    total_delayed = db.scalar(
        select(
            func.count(MedicationSchedule.id)
        ).where(
            MedicationSchedule.status == "DELAYED"
        )
    ) or 0

    if total_completed > 0:
        ward_delay_rate = (
            total_delayed / total_completed
        )
    else:
        ward_delay_rate = 0.0

    # =====================================================
    # 9. Calculate medication workload proxy
    # =====================================================
    #
    # This is NOT a clinical staffing measurement.
    #
    # It represents the number of upcoming medication
    # schedules concentrated around the same hour.
    # =====================================================

    workload_start_hour = max(
        scheduled_hour - 1,
        0,
    )

    workload_end_hour = min(
        scheduled_hour + 1,
        23,
    )

    scheduled_hour_value = (
        func.cast(
            func.strftime(
                "%H",
                MedicationSchedule.scheduled_time,
            ),
            Integer,
        )
    )

    nurse_workload = db.scalar(
        select(
            func.count(
                MedicationSchedule.id
            )
        ).where(
            scheduled_hour_value.between(
                workload_start_hour,
                workload_end_hour,
            ),
            MedicationSchedule.status == "UPCOMING",
        )
    ) or 0

    # Keep workload within the range used by
    # the synthetic training dataset.
    nurse_workload = min(
        max(
            int(nurse_workload),
            0,
        ),
        12,
    )

    # =====================================================
    # 10. Return AI features
    # =====================================================

    return {
        "ward": ward_name,

        "medicine": medicine.name,

        "frequency": item.frequency,

        "frequency_per_day": int(
            frequency_per_day
        ),

        "scheduled_hour": int(
            scheduled_hour
        ),

        "day_of_week": int(
            day_of_week
        ),

        "is_stat": int(
            item.is_stat
        ),

        "active_medications": int(
            active_medications
        ),

        "previous_delays": int(
            previous_delays
        ),

        "previous_missed": int(
            previous_missed
        ),

        "ward_delay_rate": float(
            ward_delay_rate
        ),

        "nurse_workload": int(
            nurse_workload
        ),
    }