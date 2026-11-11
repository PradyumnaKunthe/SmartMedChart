from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.mongo_client import mongo_db
from app.schemas.allergy import (
    AllergyCreate,
    AllergyResponse,
    AllergyUpdate,
)
from app.security import get_current_user


router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor Allergies"],
)


def require_allergy_clinical_permission(current_user=Depends(get_current_user)):
    """
    Ensure only clinical staff (Doctors with CREATE_PRESCRIPTION, Nurses with RECORD_MEDICATION_ADMINISTRATION)
    or System Administrators (MANAGE_SYSTEM) can add, modify, or archive allergies.
    Read-only staff (e.g. Receptionist with only VIEW_PATIENT) are strictly blocked with 403 Forbidden.
    """
    role = getattr(current_user, "role", None)
    role_name = (
        role if isinstance(role, str) else getattr(role, "name", "")
    ).lower()

    if role_name in ("admin", "administrator"):
        return current_user

    permissions = {
        getattr(p, "name", str(p)) for p in getattr(role, "permissions", [])
    }
    allowed = {
        "CREATE_PRESCRIPTION",
        "RECORD_MEDICATION_ADMINISTRATION",
        "ADMINISTER_MEDICATION",
        "MANAGE_SYSTEM",
    }
    if not (permissions & allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinical permission required to manage patient allergies. Read-only patient access is insufficient.",
        )
    return current_user


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
    current_user=Depends(require_allergy_clinical_permission),
):
    if hasattr(current_user, "default"):
        current_user = current_user.default
    if current_user and not hasattr(current_user, "dependency"):
        require_allergy_clinical_permission(current_user)

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
    now = datetime.now(timezone.utc).isoformat()

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
        "is_active": True,
        "created_by": int(current_user.id),
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
    current_user=Depends(require_allergy_clinical_permission),
):
    if hasattr(current_user, "default"):
        current_user = current_user.default
    if current_user and not hasattr(current_user, "dependency"):
        require_allergy_clinical_permission(current_user)

    allergy = mongo_db.patient_allergies.find_one({
        "$or": [
            {"_id": allergy_id, "patient_id": patient_id},
            {"id": allergy_id, "patient_id": patient_id},
        ],
        "is_active": {"$ne": False},
    })

    if allergy is None:
        raise HTTPException(
            status_code=404,
            detail="Active allergy record not found.",
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

    updates["updated_by"] = int(current_user.id)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

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
# DELETE ALLERGY (SAFE ARCHIVAL)
# =========================================================

@router.delete(
    "/patients/{patient_id}/allergies/{allergy_id}"
)
def delete_patient_allergy(
    patient_id: int,
    allergy_id: int,
    current_user=Depends(require_allergy_clinical_permission),
):
    if hasattr(current_user, "default"):
        current_user = current_user.default
    if current_user and not hasattr(current_user, "dependency"):
        require_allergy_clinical_permission(current_user)

    now = datetime.now(timezone.utc).isoformat()
    result = mongo_db.patient_allergies.update_one(
        {
            "$or": [
                {"_id": allergy_id, "patient_id": patient_id},
                {"id": allergy_id, "patient_id": patient_id},
            ],
            "is_active": {"$ne": False},
        },
        {
            "$set": {
                "is_active": False,
                "deleted_at": now,
                "deleted_by": int(current_user.id),
                "archival_status": "ARCHIVED",
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Active allergy record not found.",
        )

    return {
        "message": "Allergy archived successfully. Historical clinical audit record preserved.",
        "allergy_id": allergy_id,
        "is_archived": True,
    }