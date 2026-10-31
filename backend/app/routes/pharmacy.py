import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.mongo_client import mongo_db
from app.schemas.medicine import (
    BatchCreate,
    BatchResponse,
    DispenseCreate,
    MedicineCreate,
    MedicineResponse,
    MedicineUpdate,
)
from app.security import get_current_user

router = APIRouter(
    prefix="/api/pharmacy",
    tags=["Pharmacy Management"],
)


def pharmacy_now() -> str:
    return datetime.utcnow().isoformat()


def active_filter():
    return {"$in": [True, 1, "1"]}


def mongo_bool(value) -> bool:
    return value in (True, 1, "1", "true", "True")


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


def require_pharmacy_access(
    current_user=Depends(get_current_user),
):
    role_name = (
        current_user.role.name if hasattr(current_user, "role") and hasattr(current_user.role, "name") else ""
    ).lower()

    if role_name in ("admin", "administrator", "pharmacist"):
        return current_user

    permission_names = {
        p.name for p in getattr(current_user.role, "permissions", [])
    }

    if {"MANAGE_SYSTEM", "MANAGE_MEDICINE", "MANAGE_INVENTORY"} & permission_names:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Pharmacy management permission required.",
    )


# =========================================================
# PHARMACY DASHBOARD METRICS
# =========================================================

@router.get("/stats")
def get_pharmacy_stats(
    current_user=Depends(require_pharmacy_access),
):
    medicines = list(
        mongo_db.medicines.find({
            "is_active": active_filter(),
            "is_archived": {"$ne": True},
            "is_test": {"$ne": True},
            "name": {"$not": {"$regex": "^(test |duplicate |status test)", "$options": "i"}},
        })
    )

    total_medicines = len(medicines)
    total_stock = 0
    low_stock_count = 0
    out_of_stock_count = 0

    now_date = datetime.utcnow().date()
    thirty_days_later = (now_date + timedelta(days=30)).isoformat()
    today_str = now_date.isoformat()

    for med in medicines:
        batches = list(
            mongo_db.medicine_batches.find({
                "medicine_id": med["id"],
                "status": "ACTIVE",
                "current_quantity": {"$gt": 0},
            })
        )
        batch_stock = sum(int(b.get("current_quantity", 0)) for b in batches)
        stock = max(int(med.get("total_stock", 0)), batch_stock)
        total_stock += stock
        min_level = int(med.get("min_stock_level") or 10)

        if stock == 0:
            out_of_stock_count += 1
        elif stock <= min_level:
            low_stock_count += 1

    # Expiring batches in next 30 days
    expiring_batches = list(
        mongo_db.medicine_batches.find({
            "status": "ACTIVE",
            "current_quantity": {"$gt": 0},
            "expiry_date": {"$lte": thirty_days_later},
        })
    )
    expiring_count = len(expiring_batches)

    # Fast-moving medicines: top dispensed in stock_transactions
    pipeline = [
        {"$match": {"transaction_type": "DISPENSE"}},
        {"$group": {"_id": "$medicine_id", "total_dispensed": {"$sum": {"$ifNull": ["$dispensed_quantity", {"$abs": "$quantity"}]}}}},
        {"$match": {"total_dispensed": {"$gte": 5}}},
    ]
    fast_moving = list(mongo_db.stock_transactions.aggregate(pipeline))

    return {
        "total_medicines": total_medicines,
        "total_stock": total_stock,
        "low_stock_medicines": low_stock_count,
        "out_of_stock_medicines": out_of_stock_count,
        "fast_moving_medicines": len(fast_moving),
        "medicines_approaching_expiry": expiring_count,
    }


# =========================================================
# MEDICINE CATALOGUE
# =========================================================

@router.get("/medicines")
def list_medicines(
    search: str | None = None,
    category: str | None = None,
    stock_status: str | None = None,
    current_user=Depends(require_pharmacy_access),
):
    query = {
        "is_active": active_filter(),
        "is_archived": {"$ne": True},
        "is_test": {"$ne": True},
        "name": {"$not": {"$regex": "^(test |duplicate |status test)", "$options": "i"}},
    }

    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"generic_name": {"$regex": pattern, "$options": "i"}},
            {"brand_name": {"$regex": pattern, "$options": "i"}},
        ]

    if category and category.upper() != "ALL":
        query["category"] = {"$regex": f"^{re.escape(category.strip())}$", "$options": "i"}

    medicines = list(mongo_db.medicines.find(query).sort("name", 1))

    result = []
    for med in medicines:
        batches = list(
            mongo_db.medicine_batches.find({
                "medicine_id": med["id"],
                "status": "ACTIVE",
                "current_quantity": {"$gt": 0},
            })
        )
        batch_stock = sum(int(b.get("current_quantity", 0)) for b in batches)
        total_stock = max(int(med.get("total_stock", 0)), batch_stock)
        min_level = int(med.get("min_stock_level") or 10)

        if total_stock == 0:
            status_text = "OUT OF STOCK"
        elif total_stock <= min_level:
            status_text = "LOW STOCK"
        else:
            status_text = "IN STOCK"

        if stock_status and stock_status.upper() != "ALL" and status_text != stock_status.upper():
            continue

        result.append({
            "id": med["id"],
            "name": med.get("name"),
            "generic_name": med.get("generic_name"),
            "brand_name": med.get("brand_name"),
            "strength": med.get("strength"),
            "dosage_form": med.get("dosage_form"),
            "unit": med.get("unit") or "Tablets",
            "category": med.get("category") or "General",
            "min_stock_level": min_level,
            "supplier": med.get("supplier"),
            "total_stock": total_stock,
            "stock_status": status_text,
            "batch_count": len(batches),
            "description": med.get("description"),
            "is_active": mongo_bool(med.get("is_active")),
            "is_archived": bool(med.get("is_archived", False)),
            "created_at": med.get("created_at"),
            "updated_at": med.get("updated_at"),
        })

    return result


# =========================================================
# ADD MEDICINE (WITH DUPLICATE PREVENTION)
# =========================================================

@router.post("/medicines")
def create_medicine(
    request: MedicineCreate,
    current_user=Depends(require_pharmacy_access),
):
    name_clean = request.name.strip().upper()
    strength_clean = request.strength.strip().upper()

    # Enforce duplicate check: same name and strength in active unarchived medicines
    existing = mongo_db.medicines.find_one({
        "name": {"$regex": f"^{re.escape(name_clean)}$", "$options": "i"},
        "strength": {"$regex": f"^{re.escape(strength_clean)}$", "$options": "i"},
        "is_archived": {"$ne": True},
        "is_active": active_filter(),
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A medicine with name '{request.name.strip()}' and strength '{request.strength.strip()}' already exists in active formulary.",
        )

    now = pharmacy_now()
    med_id = next_mongo_id("medicines")

    doc = {
        "_id": med_id,
        "id": med_id,
        "name": name_clean,
        "generic_name": request.generic_name.strip().upper() if request.generic_name else None,
        "brand_name": request.brand_name.strip().upper() if request.brand_name else None,
        "strength": strength_clean,
        "dosage_form": request.dosage_form.strip().upper(),
        "unit": request.unit.strip().upper() if request.unit else "TABLETS",
        "category": request.category.strip().upper() if request.category else "GENERAL",
        "min_stock_level": int(request.min_stock_level),
        "supplier": request.supplier.strip().upper() if request.supplier else None,
        "description": request.description.strip() if request.description else None,
        "total_stock": 0,
        "is_active": 1,
        "is_archived": False,
        "is_test": False,
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.medicines.insert_one(doc)

    return {
        "message": f"Medicine '{name_clean}' added to pharmacy catalogue successfully.",
        "medicine": {
            "id": med_id,
            "name": doc["name"],
            "generic_name": doc["generic_name"],
            "brand_name": doc["brand_name"],
            "strength": doc["strength"],
            "dosage_form": doc["dosage_form"],
            "unit": doc["unit"],
            "category": doc["category"],
            "min_stock_level": doc["min_stock_level"],
            "supplier": doc["supplier"],
            "total_stock": 0,
            "stock_status": "OUT OF STOCK",
            "is_active": True,
            "is_archived": False,
        },
    }


# =========================================================
# UPDATE MEDICINE
# =========================================================

@router.put("/medicines/{medicine_id}")
def update_medicine(
    medicine_id: int,
    request: MedicineUpdate,
    current_user=Depends(require_pharmacy_access),
):
    medicine = mongo_db.medicines.find_one({
        "_id": medicine_id,
        "is_archived": {"$ne": True},
    })

    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    updates = {}
    if request.name is not None:
        name_clean = request.name.strip().upper()
        # Duplicate check if name or strength changed
        strength_to_check = request.strength.strip().upper() if request.strength else medicine.get("strength", "")
        duplicate = mongo_db.medicines.find_one({
            "_id": {"$ne": medicine_id},
            "name": {"$regex": f"^{re.escape(name_clean)}$", "$options": "i"},
            "strength": {"$regex": f"^{re.escape(strength_to_check)}$", "$options": "i"},
            "is_archived": {"$ne": True},
            "is_active": active_filter(),
        })
        if duplicate:
            raise HTTPException(400, "Another medicine with this name and strength already exists.")
        updates["name"] = name_clean

    if request.generic_name is not None:
        updates["generic_name"] = request.generic_name.strip().upper()
    if request.brand_name is not None:
        updates["brand_name"] = request.brand_name.strip().upper()
    if request.strength is not None:
        updates["strength"] = request.strength.strip().upper()
    if request.dosage_form is not None:
        updates["dosage_form"] = request.dosage_form.strip().upper()
    if request.unit is not None:
        updates["unit"] = request.unit.strip().upper()
    if request.category is not None:
        updates["category"] = request.category.strip().upper()
    if request.min_stock_level is not None:
        updates["min_stock_level"] = int(request.min_stock_level)
    if request.supplier is not None:
        updates["supplier"] = request.supplier.strip().upper()
    if request.description is not None:
        updates["description"] = request.description.strip()
    if request.is_active is not None:
        updates["is_active"] = 1 if request.is_active else 0

    updates["updated_at"] = pharmacy_now()

    mongo_db.medicines.update_one({"_id": medicine_id}, {"$set": updates})

    updated = mongo_db.medicines.find_one({"_id": medicine_id})
    return {
        "message": "Medicine updated successfully.",
        "medicine": {
            "id": updated["id"],
            "name": updated.get("name"),
            "generic_name": updated.get("generic_name"),
            "brand_name": updated.get("brand_name"),
            "strength": updated.get("strength"),
            "dosage_form": updated.get("dosage_form"),
            "unit": updated.get("unit"),
            "category": updated.get("category"),
            "min_stock_level": updated.get("min_stock_level"),
            "supplier": updated.get("supplier"),
            "total_stock": updated.get("total_stock", 0),
            "is_active": mongo_bool(updated.get("is_active")),
        },
    }


# =========================================================
# ARCHIVE / DEACTIVATE MEDICINE (SAFE SOFT DELETE)
# =========================================================

@router.delete("/medicines/{medicine_id}")
def archive_medicine(
    medicine_id: int,
    current_user=Depends(require_pharmacy_access),
):
    medicine = mongo_db.medicines.find_one({"_id": medicine_id})

    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    now = pharmacy_now()
    mongo_db.medicines.update_one(
        {"_id": medicine_id},
        {"$set": {"is_active": 0, "is_archived": True, "updated_at": now}},
    )

    return {
        "message": f"Medicine '{medicine.get('name')}' has been archived from active formulary. Historical prescriptions remain preserved.",
        "medicine_id": medicine_id,
        "is_archived": True,
    }


# =========================================================
# BATCH & STOCK MANAGEMENT
# =========================================================

@router.get("/medicines/{medicine_id}/batches")
def get_medicine_batches(
    medicine_id: int,
    current_user=Depends(require_pharmacy_access),
):
    batches = list(
        mongo_db.medicine_batches.find({
            "medicine_id": medicine_id
        }).sort("expiry_date", 1)
    )

    now_date = datetime.utcnow().date()

    result = []
    for b in batches:
        try:
            exp = datetime.fromisoformat(b["expiry_date"][:10]).date()
            days_left = (exp - now_date).days
        except Exception:
            days_left = 999

        result.append({
            "id": b["id"],
            "medicine_id": b["medicine_id"],
            "medicine_name": b.get("medicine_name"),
            "batch_number": b.get("batch_number"),
            "expiry_date": b.get("expiry_date"),
            "days_until_expiry": days_left,
            "initial_quantity": b.get("initial_quantity"),
            "current_quantity": b.get("current_quantity"),
            "supplier": b.get("supplier"),
            "status": b.get("status"),
            "created_at": b.get("created_at"),
        })

    return result


@router.post("/medicines/{medicine_id}/batches")
def add_medicine_batch(
    medicine_id: int,
    request: BatchCreate,
    current_user=Depends(require_pharmacy_access),
):
    medicine = mongo_db.medicines.find_one({
        "_id": medicine_id,
        "is_archived": {"$ne": True},
    })

    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found or archived.")

    now = pharmacy_now()
    batch_id = next_mongo_id("medicine_batches")
    tx_id = next_mongo_id("stock_transactions")

    batch_doc = {
        "_id": batch_id,
        "id": batch_id,
        "medicine_id": medicine_id,
        "medicine_name": medicine.get("name"),
        "batch_number": request.batch_number.strip().upper(),
        "expiry_date": request.expiry_date.strip(),
        "initial_quantity": int(request.quantity),
        "current_quantity": int(request.quantity),
        "supplier": (request.supplier or medicine.get("supplier") or "").strip().upper() or None,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
    }

    mongo_db.medicine_batches.insert_one(batch_doc)

    # Atomically increment total_stock
    updated_med = mongo_db.medicines.find_one_and_update(
        {"_id": medicine_id},
        {"$inc": {"total_stock": int(request.quantity)}, "$set": {"updated_at": now}},
        return_document=True,
    )

    new_balance = int(updated_med.get("total_stock", request.quantity))

    # Audit transaction log
    tx_doc = {
        "_id": tx_id,
        "id": tx_id,
        "medicine_id": medicine_id,
        "medicine_name": medicine.get("name"),
        "batch_id": batch_id,
        "batch_number": batch_doc["batch_number"],
        "transaction_type": "RESTOCK",
        "quantity": int(request.quantity),
        "balance_after": new_balance,
        "supplier": batch_doc["supplier"],
        "notes": request.notes or f"Received new batch {batch_doc['batch_number']}",
        "performed_by": getattr(current_user, "username", "admin"),
        "created_at": now,
    }

    mongo_db.stock_transactions.insert_one(tx_doc)

    return {
        "message": f"Successfully received {request.quantity} units for batch {batch_doc['batch_number']}.",
        "batch": {
            "id": batch_id,
            "batch_number": batch_doc["batch_number"],
            "expiry_date": batch_doc["expiry_date"],
            "quantity": batch_doc["current_quantity"],
            "status": "ACTIVE",
        },
        "total_stock": new_balance,
    }


# =========================================================
# DISPENSE WORKFLOW (DEDUCTS STOCK ATOMICALLY)
# =========================================================

@router.post("/dispense")
def dispense_medicine(
    request: DispenseCreate,
    current_user=Depends(require_pharmacy_access),
):
    medicine = mongo_db.medicines.find_one({
        "_id": request.medicine_id,
        "is_archived": {"$ne": True},
    })

    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    qty_to_dispense = int(request.quantity)
    if qty_to_dispense <= 0:
        raise HTTPException(status_code=400, detail="Quantity to dispense must be greater than zero.")

    # Prevent duplicate dispense for the same prescription item if already dispensed
    if request.prescription_id:
        existing_tx = mongo_db.stock_transactions.find_one({
            "prescription_id": request.prescription_id,
            "medicine_id": request.medicine_id,
            "transaction_type": "DISPENSE",
        })
        if existing_tx:
            raise HTTPException(
                status_code=400,
                detail=f"Prescription #{request.prescription_id} has already been dispensed on {existing_tx.get('created_at')[:10]}.",
            )

    now = pharmacy_now()

    # Find candidate batch: requested batch_id or earliest expiring active batch with quantity
    batch = None
    if request.batch_id:
        batch = mongo_db.medicine_batches.find_one({
            "_id": request.batch_id,
            "medicine_id": request.medicine_id,
            "status": "ACTIVE",
            "current_quantity": {"$gte": qty_to_dispense},
        })
        if not batch:
            raise HTTPException(400, "Specified batch does not have sufficient available stock.")
    else:
        # Auto-pick earliest expiring batch with sufficient quantity
        batches = list(
            mongo_db.medicine_batches.find({
                "medicine_id": request.medicine_id,
                "status": "ACTIVE",
                "current_quantity": {"$gt": 0},
            }).sort("expiry_date", 1)
        )
        for b in batches:
            if b.get("current_quantity", 0) >= qty_to_dispense:
                batch = b
                break

        if not batch:
            total_avail = sum(b.get("current_quantity", 0) for b in batches)
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient inventory across batches. Total available: {total_avail}, requested: {qty_to_dispense}.",
            )

    # Atomically decrement batch quantity
    updated_batch = mongo_db.medicine_batches.find_one_and_update(
        {
            "_id": batch["_id"],
            "current_quantity": {"$gte": qty_to_dispense},
        },
        {
            "$inc": {"current_quantity": -qty_to_dispense},
            "$set": {"updated_at": now},
        },
        return_document=True,
    )

    if not updated_batch:
        raise HTTPException(status_code=409, detail="Concurrent inventory update conflict. Please retry.")

    # If batch depleted, update status
    if updated_batch.get("current_quantity") == 0:
        mongo_db.medicine_batches.update_one(
            {"_id": batch["_id"]},
            {"$set": {"status": "DEPLETED", "updated_at": now}},
        )

    # Atomically decrement total_stock on medicine
    updated_med = mongo_db.medicines.find_one_and_update(
        {"_id": request.medicine_id},
        {"$inc": {"total_stock": -qty_to_dispense}, "$set": {"updated_at": now}},
        return_document=True,
    )

    new_total = int(updated_med.get("total_stock", 0))

    # Patient info if provided
    patient_name = None
    if request.patient_id:
        patient = mongo_db.patients.find_one({"_id": request.patient_id})
        if patient:
            patient_name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()

    tx_id = next_mongo_id("stock_transactions")
    tx_doc = {
        "_id": tx_id,
        "id": tx_id,
        "medicine_id": request.medicine_id,
        "medicine_name": medicine.get("name"),
        "batch_id": batch["id"],
        "batch_number": batch.get("batch_number"),
        "transaction_type": "DISPENSE",
        "quantity": -qty_to_dispense,
        "dispensed_quantity": qty_to_dispense,
        "balance_after": new_total,
        "patient_id": request.patient_id,
        "patient_name": patient_name,
        "prescription_id": request.prescription_id,
        "notes": request.notes or f"Dispensed {qty_to_dispense} units for clinical regimen",
        "performed_by": getattr(current_user, "username", "pharmacist"),
        "created_at": now,
    }

    mongo_db.stock_transactions.insert_one(tx_doc)

    return {
        "message": f"Successfully dispensed {qty_to_dispense} units of {medicine.get('name')}.",
        "transaction_id": tx_id,
        "batch_number": batch.get("batch_number"),
        "quantity_dispensed": qty_to_dispense,
        "batch_remaining": updated_batch.get("current_quantity"),
        "medicine_total_stock": new_total,
    }


# =========================================================
# STOCK TRANSACTIONS (AUDIT TRAIL)
# =========================================================

@router.get("/stock-transactions")
def list_stock_transactions(
    transaction_type: str | None = None,
    medicine_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    current_user=Depends(require_pharmacy_access),
):
    query = {}
    if transaction_type and transaction_type.upper() != "ALL":
        query["transaction_type"] = transaction_type.upper()
    if medicine_id:
        query["medicine_id"] = medicine_id

    limit_val = int(limit.default if hasattr(limit, "default") else limit)

    transactions = list(
        mongo_db.stock_transactions.find(query).sort("created_at", -1).limit(limit_val)
    )

    return [
        {
            "id": tx.get("id", tx.get("_id")),
            "medicine_id": tx.get("medicine_id"),
            "medicine_name": tx.get("medicine_name"),
            "batch_id": tx.get("batch_id"),
            "batch_number": tx.get("batch_number"),
            "transaction_type": tx.get("transaction_type"),
            "quantity": tx.get("quantity"),
            "balance_after": tx.get("balance_after"),
            "patient_id": tx.get("patient_id"),
            "patient_name": tx.get("patient_name"),
            "prescription_id": tx.get("prescription_id"),
            "performed_by": tx.get("performed_by"),
            "notes": tx.get("notes"),
            "created_at": tx.get("created_at"),
        }
        for tx in transactions
    ]


# =========================================================
# USAGE & CONSUMPTION REPORTS
# =========================================================

@router.get("/reports/usage")
def get_usage_reports(
    current_user=Depends(require_pharmacy_access),
):
    now = datetime.utcnow()
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    # Get all active medicines
    medicines = list(
        mongo_db.medicines.find({
            "is_active": active_filter(),
            "is_archived": {"$ne": True},
            "is_test": {"$ne": True},
            "name": {"$not": {"$regex": "^(test |duplicate |status test)", "$options": "i"}},
        })
    )

    reports = []
    for med in medicines:
        med_id = med["id"]

        # All-time dispensed
        all_tx = list(mongo_db.stock_transactions.find({
            "medicine_id": med_id,
            "transaction_type": "DISPENSE",
        }))
        total_dispensed = sum(abs(int(tx.get("quantity", 0))) for tx in all_tx)

        # Weekly
        weekly_tx = [tx for tx in all_tx if tx.get("created_at", "") >= seven_days_ago]
        weekly_dispensed = sum(abs(int(tx.get("quantity", 0))) for tx in weekly_tx)

        # Monthly
        monthly_tx = [tx for tx in all_tx if tx.get("created_at", "") >= thirty_days_ago]
        monthly_dispensed = sum(abs(int(tx.get("quantity", 0))) for tx in monthly_tx)

        stock = int(med.get("total_stock", 0))
        min_level = int(med.get("min_stock_level") or 10)

        # Suggested reorder quantity
        suggested_reorder = max((min_level * 2) - stock, 50) if stock <= min_level else 0

        reports.append({
            "medicine_id": med_id,
            "medicine_name": med.get("name"),
            "strength": med.get("strength"),
            "dosage_form": med.get("dosage_form"),
            "category": med.get("category") or "General",
            "available_stock": stock,
            "min_stock_level": min_level,
            "weekly_consumption": weekly_dispensed,
            "monthly_consumption": monthly_dispensed,
            "total_dispensed": total_dispensed,
            "suggested_reorder": suggested_reorder,
            "stock_status": "OUT OF STOCK" if stock == 0 else ("LOW STOCK" if stock <= min_level else "IN STOCK"),
        })

    # Sort by total dispensed descending (fast-moving first)
    reports.sort(key=lambda x: (x["total_dispensed"], x["monthly_consumption"]), reverse=True)

    return {
        "reports": reports,
        "summary": {
            "total_medicines_analyzed": len(reports),
            "fast_moving_count": sum(1 for r in reports if r["total_dispensed"] >= 5),
            "restock_required_count": sum(1 for r in reports if r["available_stock"] <= r["min_stock_level"]),
        },
    }


# =========================================================
# LOW STOCK & EXPIRY ALERTS
# =========================================================

@router.get("/alerts/low-stock")
def get_low_stock_alerts(
    current_user=Depends(require_pharmacy_access),
):
    medicines = list(
        mongo_db.medicines.find({
            "is_active": active_filter(),
            "is_archived": {"$ne": True},
            "is_test": {"$ne": True},
            "name": {"$not": {"$regex": "^(test |duplicate |status test)", "$options": "i"}},
        })
    )

    alerts = []
    for med in medicines:
        stock = int(med.get("total_stock", 0))
        min_level = int(med.get("min_stock_level") or 10)

        if stock <= min_level:
            suggested = max((min_level * 2) - stock, 50)
            alerts.append({
                "medicine_id": med["id"],
                "medicine_name": med.get("name"),
                "strength": med.get("strength"),
                "dosage_form": med.get("dosage_form"),
                "unit": med.get("unit") or "Tablets",
                "current_stock": stock,
                "min_stock_level": min_level,
                "deficit": max(0, min_level - stock),
                "suggested_reorder_quantity": suggested,
                "status": "OUT OF STOCK" if stock == 0 else "LOW STOCK",
                "supplier": med.get("supplier"),
            })

    alerts.sort(key=lambda x: (x["current_stock"], -x["deficit"]))
    return alerts


@router.get("/alerts/expiry")
def get_expiry_alerts(
    current_user=Depends(require_pharmacy_access),
):
    now_date = datetime.utcnow().date()
    batches = list(
        mongo_db.medicine_batches.find({
            "status": "ACTIVE",
            "current_quantity": {"$gt": 0},
        }).sort("expiry_date", 1)
    )

    alerts = []
    for b in batches:
        try:
            exp = datetime.fromisoformat(b["expiry_date"][:10]).date()
            days_left = (exp - now_date).days
        except Exception:
            days_left = 999

        if days_left <= 90:
            if days_left <= 0:
                alert_level = "EXPIRED"
            elif days_left <= 30:
                alert_level = "CRITICAL"
            else:
                alert_level = "APPROACHING"

            alerts.append({
                "batch_id": b["id"],
                "medicine_id": b.get("medicine_id"),
                "medicine_name": b.get("medicine_name"),
                "batch_number": b.get("batch_number"),
                "expiry_date": b.get("expiry_date"),
                "days_remaining": days_left,
                "current_quantity": b.get("current_quantity"),
                "supplier": b.get("supplier"),
                "alert_level": alert_level,
            })

    alerts.sort(key=lambda x: x["days_remaining"])
    return alerts
