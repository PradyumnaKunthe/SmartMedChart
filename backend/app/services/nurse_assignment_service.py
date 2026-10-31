from app.mongo_client import mongo_db


def get_assigned_patient_ids(
    nurse_id: int,
    db=None,
) -> set[int]:
    assignments = mongo_db.nurse_patient_assignments.find(
        {
            "nurse_id": int(nurse_id),
            "is_active": {"$in": [1, True]},
        },
        {"patient_id": 1},
    )

    return {
        int(row["patient_id"])
        for row in assignments
        if row.get("patient_id") is not None
    }


def is_patient_assigned(
    nurse_id: int,
    patient_id: int,
    db=None,
) -> bool:
    return mongo_db.nurse_patient_assignments.find_one(
        {
            "nurse_id": int(nurse_id),
            "patient_id": int(patient_id),
            "is_active": {"$in": [1, True]},
        }
    ) is not None