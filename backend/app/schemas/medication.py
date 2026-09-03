from datetime import date, time, datetime

from pydantic import BaseModel, ConfigDict


class MedicationScheduleResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    # -----------------------------------------------------
    # Schedule information
    # -----------------------------------------------------

    id: int
    prescription_item_id: int

    scheduled_date: date
    scheduled_time: time

    status: str

    actual_administration_time: datetime | None = None
    administered_by: int | None = None
    notes: str | None = None

    # -----------------------------------------------------
    # Patient information
    # -----------------------------------------------------

    patient_id: int | None = None
    patient_name: str | None = None
    patient_code: str | None = None

    # -----------------------------------------------------
    # Medicine / prescription information
    # -----------------------------------------------------

    medicine_id: int | None = None
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