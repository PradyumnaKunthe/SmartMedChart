from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo import ReturnDocument

from app.mongo_client import mongo_db
from app.schemas.medication_verification import (
    MedicationVerificationRequest,
    MedicationVerificationResponse,
)
from app.schemas.qr import QRVerifyRequest, QRVerifyResponse
from app.security import require_permission
from app.services.nurse_assignment_service import (
    is_patient_assigned,
)


router = APIRouter(
    prefix="/api/nurse/qr",
    tags=["Nurse QR"],
)


def next_mongo_id(collection_name: str) -> int:
    collection = mongo_db[collection_name]
    latest = collection.find_one(
        {},
        sort=[("_id", -1)],
        projection={"_id": 1},
    )
    maximum = (
        int(latest["_id"])
        if latest and isinstance(latest["_id"], int)
        else 0
    )

    counters = mongo_db["_id_sequences"]
    counters.update_one(
        {"_id": collection_name},
        {"$max": {"value": maximum}},
        upsert=True,
    )
    result = counters.find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"value": 1}},
        return_document=ReturnDocument.AFTER,
    )
    return int(result["value"])


# =========================================================
# VERIFY PATIENT QR
# =========================================================

@router.post(
    "/verify",
    response_model=QRVerifyResponse,
)
def verify_patient_qr(
    request: QRVerifyRequest,
    current_user=Depends(
        require_permission("VERIFY_QR")
    ),
):
    """
    Verify a patient's QR token.

    A nurse can verify the QR only when the patient
    is actively assigned to that nurse.
    """

    # -----------------------------------------------------
    # 1. Find patient from QR token in MongoDB
    # -----------------------------------------------------

    patient = mongo_db.patients.find_one({
        "qr_token": request.qr_token,
        "qr_is_active": {"$in": [1, True]},
        "is_active": {"$in": [1, True]},
    })

    # -----------------------------------------------------
    # 2. Invalid or inactive QR
    # -----------------------------------------------------

    if patient is None:
        return QRVerifyResponse(
            valid=False,
            patient_id=None,
            message="Invalid or inactive patient QR.",
        )

    patient_id = int(patient.get("id", patient.get("_id")))

    # -----------------------------------------------------
    # 3. Check nurse assignment
    # -----------------------------------------------------

    if not is_patient_assigned(
        nurse_id=int(current_user.id),
        patient_id=patient_id,
    ):
        return QRVerifyResponse(
            valid=False,
            patient_id=patient_id,
            message=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    # -----------------------------------------------------
    # 4. Save successful patient verification in MongoDB
    # -----------------------------------------------------

    v_id = next_mongo_id("qr_verifications")
    now = datetime.now(timezone.utc).isoformat()

    verification_doc = {
        "_id": v_id,
        "id": v_id,
        "patient_id": patient_id,
        "medication_schedule_id": None,
        "verified_by": int(current_user.id),
        "verified_at": now,
        "patient_qr_valid": True,
        "medication_valid": None,
        "result": "SUCCESS",
        "message": "Patient QR verified successfully.",
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.qr_verifications.insert_one(verification_doc)

    return QRVerifyResponse(
        valid=True,
        patient_id=patient_id,
        message="Patient QR verified successfully.",
    )


# =========================================================
# VERIFY MEDICATION
# =========================================================

@router.post(
    "/verify-medication",
    response_model=MedicationVerificationResponse,
)
def verify_medication(
    request: MedicationVerificationRequest,
    current_user=Depends(
        require_permission("VERIFY_QR")
    ),
):
    """
    Verify that a medication schedule belongs to
    the selected patient and that the patient is
    assigned to the logged-in nurse.
    """

    # -----------------------------------------------------
    # 1. Verify patient
    # -----------------------------------------------------

    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": request.patient_id},
            {"id": request.patient_id},
        ],
        "is_active": {"$in": [1, True]},
    })

    if patient is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=request.patient_id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message="Patient not found or inactive.",
        )

    patient_id = int(patient.get("id", patient.get("_id")))

    # -----------------------------------------------------
    # 2. Check nurse assignment
    # -----------------------------------------------------

    if not is_patient_assigned(
        nurse_id=int(current_user.id),
        patient_id=patient_id,
    ):
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message=(
                "This patient is not assigned "
                "to this nurse."
            ),
        )

    # -----------------------------------------------------
    # 3. Verify medication schedule
    # -----------------------------------------------------

    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": request.medication_schedule_id},
            {"id": request.medication_schedule_id},
        ]
    })

    if schedule is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=(
                request.medication_schedule_id
            ),
            message="Medication schedule not found.",
        )

    schedule_id = int(schedule.get("id", schedule.get("_id")))
    prescription_item_id = int(schedule["prescription_item_id"])

    # -----------------------------------------------------
    # 4. Get prescription item
    # -----------------------------------------------------

    prescription_item = mongo_db.prescription_items.find_one({
        "$or": [
            {"_id": prescription_item_id},
            {"id": prescription_item_id},
        ]
    })

    if prescription_item is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message="Prescription item not found.",
        )

    prescription_id = int(prescription_item["prescription_id"])
    medicine_id = int(prescription_item["medicine_id"])

    # -----------------------------------------------------
    # 5. Get prescription
    # -----------------------------------------------------

    prescription = mongo_db.prescriptions.find_one({
        "$or": [
            {"_id": prescription_id},
            {"id": prescription_id},
        ]
    })

    if prescription is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message="Prescription not found.",
        )

    # -----------------------------------------------------
    # 6. Verify prescription belongs to patient
    # -----------------------------------------------------

    if int(prescription["patient_id"]) != patient_id:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message=(
                "Medication does not belong "
                "to this patient."
            ),
        )

    # -----------------------------------------------------
    # 7. Prescription must be active
    # -----------------------------------------------------

    if prescription.get("status") != "ACTIVE":
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message="Prescription is not active.",
        )

    # -----------------------------------------------------
    # 8. Prescription item must be active
    # -----------------------------------------------------

    if prescription_item.get("status", "ACTIVE") != "ACTIVE":
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message="Prescription item is not active.",
        )

    # -----------------------------------------------------
    # 9. Find medicine
    # -----------------------------------------------------

    medicine = mongo_db.medicines.find_one({
        "$or": [
            {"_id": medicine_id},
            {"id": medicine_id},
        ]
    })

    if medicine is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            message="Medicine not found.",
        )

    # -----------------------------------------------------
    # 10. Medicine must be active
    # -----------------------------------------------------

    if not (medicine.get("is_active") in (1, True)):
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            medicine_id=medicine_id,
            medicine_name=medicine.get("name"),
            message="Medicine is inactive.",
        )

    # -----------------------------------------------------
    # 11. Find latest successful patient QR verification in MongoDB
    # -----------------------------------------------------

    verification = mongo_db.qr_verifications.find_one(
        {
            "patient_id": patient_id,
            "verified_by": int(current_user.id),
            "patient_qr_valid": {"$in": [1, True]},
        },
        sort=[("_id", -1)],
    )

    now = datetime.now(timezone.utc).isoformat()

    # -----------------------------------------------------
    # 12. Update or create verification record in MongoDB
    # -----------------------------------------------------

    if verification is not None:
        mongo_db.qr_verifications.update_one(
            {"_id": verification["_id"]},
            {
                "$set": {
                    "medication_schedule_id": schedule_id,
                    "medication_valid": True,
                    "result": "SUCCESS",
                    "message": "Patient and medication verified successfully.",
                    "updated_at": now,
                }
            },
        )
    else:
        v_id = next_mongo_id("qr_verifications")
        mongo_db.qr_verifications.insert_one({
            "_id": v_id,
            "id": v_id,
            "patient_id": patient_id,
            "medication_schedule_id": schedule_id,
            "verified_by": int(current_user.id),
            "verified_at": now,
            "patient_qr_valid": True,
            "medication_valid": True,
            "result": "SUCCESS",
            "message": "Patient and medication verified successfully.",
            "created_at": now,
            "updated_at": now,
        })

    # -----------------------------------------------------
    # 13. Successful response
    # -----------------------------------------------------

    return MedicationVerificationResponse(
        valid=True,
        patient_id=patient_id,
        medication_schedule_id=schedule_id,
        medicine_id=medicine_id,
        medicine_name=medicine.get("name"),
        message="Medication verified for patient.",
    )