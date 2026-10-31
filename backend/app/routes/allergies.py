from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.mongo_client import mongo_db
from app.schemas.allergy import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
)
from app.security import require_permission


router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor Allergies"],
)


def next_mongo_id(collection_name: str) -> int:
    collection = mongo_db[collection_name]
    latest = collection.find_one(
        {},
        sort=[("_id", -1)],
        projection={"_id": 1},
    )
    maximum = 0
    if latest:
        val = latest.get("_id")
        if isinstance(val, int):
            maximum = val
        elif isinstance(val, str) and val.isdigit():
            maximum = int(val)

    counters = mongo_db["_id_sequences"]
    counters.update_one(
        {"_id": collection_name},
        {"$max": {"value": maximum}},
        upsert=True,
    )
    result = counters.find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"value": 1}},
        return_document=True,
    )
    return int(result["value"])


# =========================================================
# ADD ALLERGY
# =========================================================

@router.post(
    "/patients/{patient_id}/allergies",
    response_model=AllergyResponse,
)
def create_patient_allergy(
    patient_id: int,
    request: AllergyCreate,
    current_user=Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    patient = mongo_db.patients.find_one({
        "$or": [
            {"_id": patient_id},
            {"id": patient_id},
        ],
        "is_active": {"$in": [1, True, "1"]},
    })

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    allergy_id = next_mongo_id("patient_allergies")
    now = datetime.utcnow().isoformat()

    allergy_doc = {
        "_id": allergy_id,
        "id": allergy_id,
        "patient_id": patient_id,
        "allergen": request.allergen.strip(),
        "reaction": (
            request.reaction.strip()
            if request.reaction
            else None
        ),
        "severity": (
            request.severity.strip().upper()
            if request.severity
            else None
        ),
        "notes": (
            request.notes.strip()
            if request.notes
            else None
        ),
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.patient_allergies.insert_one(allergy_doc)

    return {
        "id": allergy_doc["id"],
        "patient_id": allergy_doc["patient_id"],
        "allergen": allergy_doc["allergen"],
        "reaction": allergy_doc["reaction"],
        "severity": allergy_doc["severity"],
        "notes": allergy_doc["notes"],
    }


# =========================================================
# UPDATE ALLERGY
# =========================================================

@router.put(
    "/patients/{patient_id}/allergies/{allergy_id}",
    response_model=AllergyResponse,
)
def update_patient_allergy(
    patient_id: int,
    allergy_id: int,
    request: AllergyUpdate,
    current_user=Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    allergy = mongo_db.patient_allergies.find_one({
        "$or": [
            {"_id": allergy_id, "patient_id": patient_id},
            {"id": allergy_id, "patient_id": patient_id},
        ]
    })

    if allergy is None:
        raise HTTPException(
            status_code=404,
            detail="Allergy not found.",
        )

    update_data = request.model_dump(
        exclude_unset=True
    )

    updates = {}
    if "allergen" in update_data and update_data["allergen"]:
        updates["allergen"] = update_data["allergen"].strip()

    if "reaction" in update_data:
        updates["reaction"] = (
            update_data["reaction"].strip()
            if update_data["reaction"]
            else None
        )

    if "severity" in update_data:
        updates["severity"] = (
            update_data["severity"].strip().upper()
            if update_data["severity"]
            else None
        )

    if "notes" in update_data:
        updates["notes"] = (
            update_data["notes"].strip()
            if update_data["notes"]
            else None
        )

    updates["updated_at"] = datetime.utcnow().isoformat()

    updated = mongo_db.patient_allergies.find_one_and_update(
        {"_id": allergy["_id"]},
        {"$set": updates},
        return_document=True,
    )

    return {
        "id": updated.get("id", updated.get("_id")),
        "patient_id": updated["patient_id"],
        "allergen": updated["allergen"],
        "reaction": updated.get("reaction"),
        "severity": updated.get("severity"),
        "notes": updated.get("notes"),
    }


# =========================================================
# DELETE ALLERGY
# =========================================================

@router.delete(
    "/patients/{patient_id}/allergies/{allergy_id}"
)
def delete_patient_allergy(
    patient_id: int,
    allergy_id: int,
    current_user=Depends(
        require_permission("VIEW_PATIENT")
    ),
):
    result = mongo_db.patient_allergies.delete_one({
        "$or": [
            {"_id": allergy_id, "patient_id": patient_id},
            {"id": allergy_id, "patient_id": patient_id},
        ]
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Allergy not found.",
        )

    return {
        "message": "Allergy removed successfully.",
        "allergy_id": allergy_id,
    }