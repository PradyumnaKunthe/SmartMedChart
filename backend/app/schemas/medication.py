from datetime import date, time, datetime
from pydantic import BaseModel, ConfigDict


class MedicationScheduleResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    # -----------------------------------------------------
    # Schedule information
    # -----------------------------------------------------
    id: int | str
    prescription_item_id: int | str | None = None

    scheduled_date: date
    scheduled_time: time

    status: str
    monitoring_status: str | None = None
    delay_minutes: float | None = None

    actual_administration_time: datetime | str | None = None
    administered_at: datetime | str | None = None
    administered_by: int | str | None = None
    administered_by_name: str | None = None
    nurse_name: str | None = None
    notes: str | None = None

    # -----------------------------------------------------
    # Patient information
    # -----------------------------------------------------
    patient_id: int | str | None = None
    patient_name: str | None = None
    patient_code: str | None = None

    # -----------------------------------------------------
    # Medicine / prescription information
    # -----------------------------------------------------
    medicine_id: int | str | None = None
    medicine_name: str | None = None
    generic_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None

    dose: str | None = None
    route: str | None = None
    frequency: str | None = None
    duration_days: int | None = None

    is_stat: bool = False
    instructions: str | None = None

    # -----------------------------------------------------
    # Assignment & Accountability
    # -----------------------------------------------------
    is_assigned: bool = True
    assigned_nurse_id: int | None = None
    assigned_nurse_name: str | None = None
    is_override: bool = False
    override_reason: str | None = None