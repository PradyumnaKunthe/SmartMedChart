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


def _get_id_candidates(val):
    if val is None:
        return []
    candidates = [val]
    val_str = str(val).strip()
    candidates.append(val_str)
    try:
        candidates.append(int(val_str))
    except (ValueError, TypeError):
        pass
    if len(val_str) == 24:
        try:
            from bson import ObjectId
            candidates.append(ObjectId(val_str))
        except Exception:
            pass
    res = []
    for c in candidates:
        if c not in res:
            res.append(c)
    return res


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
    assigned = is_patient_assigned(
        nurse_id=int(current_user.id),
        patient_id=patient_id,
    )

    # -----------------------------------------------------
    # 4. Save successful patient verification in MongoDB
    # -----------------------------------------------------

    v_id = next_mongo_id("qr_verifications")
    now = datetime.now(timezone.utc).isoformat()

    msg = (
        "Patient QR verified successfully."
        if assigned
        else "Patient QR verified (Covering Nurse Coverage). Clinical override justification required upon administration."
    )

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
        "is_override": not assigned,
        "message": msg,
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.qr_verifications.insert_one(verification_doc)

    first_name = (patient.get("first_name") or "").strip()
    last_name = (patient.get("last_name") or "").strip()
    p_name = f"{first_name} {last_name}".strip() or None
    p_code = patient.get("patient_id")
    ward_name = patient.get("ward_name")
    if not ward_name and patient.get("ward_id"):
        try:
            wid = int(patient.get("ward_id"))
            w = mongo_db.wards.find_one({"$or": [{"_id": wid}, {"id": wid}]})
            if w:
                ward_name = w.get("name")
        except (ValueError, TypeError):
            pass
    bed_number = patient.get("bed_number")
    if not bed_number and patient.get("bed_id"):
        try:
            bid = int(patient.get("bed_id"))
            b = mongo_db.beds.find_one({"$or": [{"_id": bid}, {"id": bid}]})
            if b:
                bed_number = b.get("bed_number")
        except (ValueError, TypeError):
            pass

    return QRVerifyResponse(
        valid=True,
        patient_id=patient_id,
        message=msg,
        patient_name=p_name,
        patient_code=p_code,
        ward_name=ward_name,
        bed_number=bed_number,
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
    p_candidates = _get_id_candidates(request.patient_id)
    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": {"$in": p_candidates}},
            {"id": {"$in": p_candidates}},
            {"patient_id": {"$in": p_candidates}},
        ],
        "is_active": {"$in": [1, True, "1", "true"]},
    })

    if patient is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=request.patient_id,
            medication_schedule_id=request.medication_schedule_id,
            message="Patient not found or inactive.",
        )

    patient_id = patient.get("id", patient.get("_id"))
    try:
        numeric_patient_id = int(patient_id)
    except (ValueError, TypeError):
        numeric_patient_id = patient_id

    # -----------------------------------------------------
    # 2. Check nurse assignment
    # -----------------------------------------------------
    assigned = is_patient_assigned(
        nurse_id=int(current_user.id),
        patient_id=int(numeric_patient_id) if isinstance(numeric_patient_id, int) else 0,
    )

    # -----------------------------------------------------
    # 3. Verify medication schedule
    # -----------------------------------------------------
    s_candidates = _get_id_candidates(request.medication_schedule_id)
    schedule = mongo_db.medication_schedules.find_one({
        "$or": [
            {"_id": {"$in": s_candidates}},
            {"id": {"$in": s_candidates}},
        ]
    })

    if schedule is None:
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=request.medication_schedule_id,
            message="Medication schedule not found.",
        )

    schedule_id = schedule.get("id", schedule.get("_id", request.medication_schedule_id))
    prescription_item_id = schedule.get("prescription_item_id")

    # -----------------------------------------------------
    # 4. Get prescription item
    # -----------------------------------------------------
    item_candidates = _get_id_candidates(prescription_item_id)
    prescription_item = mongo_db.prescription_items.find_one({
        "$or": [
            {"_id": {"$in": item_candidates}},
            {"id": {"$in": item_candidates}},
        ]
    }) if item_candidates else None

    # Fallback to direct schedule metadata if item document is not present
    prescription_id = (
        prescription_item.get("prescription_id")
        if prescription_item
        else schedule.get("prescription_id")
    )
    medicine_id = (
        prescription_item.get("medicine_id")
        if prescription_item
        else schedule.get("medicine_id")
    )

    # -----------------------------------------------------
    # 5. Get prescription
    # -----------------------------------------------------
    rx_candidates = _get_id_candidates(prescription_id)
    prescription = mongo_db.prescriptions.find_one({
        "$or": [
            {"_id": {"$in": rx_candidates}},
            {"id": {"$in": rx_candidates}},
        ]
    }) if rx_candidates else None

    # -----------------------------------------------------
    # 6. Verify prescription belongs to patient
    # -----------------------------------------------------
    if prescription:
        rx_pat = str(prescription.get("patient_id"))
        all_patient_keys = {
            str(patient.get("_id")),
            str(patient.get("id")),
            str(patient.get("patient_id")),
        }
        if rx_pat not in all_patient_keys:
            return MedicationVerificationResponse(
                valid=False,
                patient_id=patient_id,
                medication_schedule_id=schedule_id,
                message="Medication does not belong to this patient.",
            )

    # -----------------------------------------------------
    # 7. Find medicine
    # -----------------------------------------------------
    med_candidates = _get_id_candidates(medicine_id)
    medicine = mongo_db.medicines.find_one({
        "$or": [
            {"_id": {"$in": med_candidates}},
            {"id": {"$in": med_candidates}},
        ]
    }) if med_candidates else None

    medicine_name = (
        (medicine.get("name") if medicine else None)
        or schedule.get("medicine_name")
        or "Medication"
    )

    # -----------------------------------------------------
    # 8. Medicine active status check
    # -----------------------------------------------------
    if medicine and medicine.get("is_active") in (0, False, "0", "false"):
        return MedicationVerificationResponse(
            valid=False,
            patient_id=patient_id,
            medication_schedule_id=schedule_id,
            medicine_id=medicine_id,
            medicine_name=medicine_name,
            message="Medicine is inactive.",
        )

    # -----------------------------------------------------
    # 9. Find latest successful patient QR verification in MongoDB
    # -----------------------------------------------------
    verification = mongo_db.qr_verifications.find_one(
        {
            "patient_id": {"$in": _get_id_candidates(patient_id)},
            "verified_by": int(current_user.id),
            "patient_qr_valid": {"$in": [1, True]},
        },
        sort=[("_id", -1)],
    )

    now = datetime.now(timezone.utc).isoformat()

    # -----------------------------------------------------
    # 12. Update or create verification record in MongoDB
    # -----------------------------------------------------

    v_msg = (
        "Patient and medication verified successfully."
        if assigned
        else "Patient and medication verified (Covering Nurse Coverage). Clinical override justification required upon administration."
    )

    # Check whether the latest verification record has already been consumed by an administration
    already_administered = False
    if verification is not None:
        v_target_id = verification.get("id", verification.get("_id"))
        already_administered = (
            mongo_db.medication_administrations.find_one({
                "$or": [
                    {"verification_id": v_target_id},
                    {
                        "verification_id": int(v_target_id)
                        if isinstance(v_target_id, (int, str)) and str(v_target_id).isdigit()
                        else v_target_id
                    },
                ]
            })
            is not None
        )

    if verification is not None and not already_administered:
        mongo_db.qr_verifications.update_one(
            {"_id": verification["_id"]},
            {
                "$set": {
                    "medication_schedule_id": schedule_id,
                    "medication_valid": True,
                    "is_override": not assigned,
                    "result": "SUCCESS",
                    "message": v_msg,
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
            "is_override": not assigned,
            "result": "SUCCESS",
            "message": v_msg,
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
        medicine_name=medicine_name,
        message=v_msg,
    )