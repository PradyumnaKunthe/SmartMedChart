import os
import re
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables (from backend/.env or system environment)
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://127.0.0.1:27017",
)

MONGODB_DATABASE = os.getenv(
    "MONGODB_DATABASE",
    "smartmedchart",
)


def mask_mongo_uri(uri: str) -> str:
    """Mask user credentials in MongoDB connection string for safe logging."""
    if not uri:
        return ""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", uri)


# Warn if running in production mode with a localhost connection string
is_production = (
    os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
    or bool(os.getenv("RENDER"))
)
if is_production and ("localhost" in MONGODB_URI or "127.0.0.1" in MONGODB_URI):
    import warnings

    warnings.warn(
        "MONGODB_URI is configured with a localhost address in a production environment. "
        "Please provide a MongoDB Atlas connection string."
    )

# Create the MongoDB client (supports local MongoDB and MongoDB Atlas SRV)
mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
)

# Select the configured database
mongo_db = mongo_client[MONGODB_DATABASE]


def ping_mongodb():
    """Check whether the MongoDB server is reachable."""
    return mongo_client.admin.command("ping")


def get_next_sequence_value(collection_name: str) -> int:
    """Return the next auto-increment integer ID for a collection."""
    latest = mongo_db[collection_name].find_one(sort=[("_id", -1)])
    maximum = (
        int(latest["_id"])
        if latest and isinstance(latest.get("_id"), int)
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
        return_document=True,
    )
    return int(result["value"])


# Alias for convenience
next_mongo_id = get_next_sequence_value


def init_security_indexes():
    """Ensure essential uniqueness and data integrity indexes exist in MongoDB."""
    try:
        # Unique username index
        mongo_db.users.create_index(
            [("username", 1)],
            unique=True,
            name="uq_users_username"
        )
        # Unique email index
        mongo_db.users.create_index(
            [("email", 1)],
            unique=True,
            name="uq_users_email"
        )
        # Unique patient code index
        mongo_db.patients.create_index(
            [("patient_id", 1)],
            unique=True,
            name="uq_patients_patient_id"
        )
        # Unique patient QR token index (partial for string values)
        mongo_db.patients.create_index(
            [("qr_token", 1)],
            unique=True,
            name="uq_patients_qr_token",
            partialFilterExpression={"qr_token": {"$type": "string"}}
        )
        # Unique medication schedule administration index (prevents duplicate administration records)
        mongo_db.medication_administrations.create_index(
            [("medication_schedule_id", 1)],
            unique=True,
            name="uq_med_admin_schedule_id"
        )
        # Unique doctor appointment slot index for CareMatch
        mongo_db.carematch_appointments.create_index(
            [
                ("doctor_id", 1),
                ("appointment_date", 1),
                ("appointment_time", 1),
            ],
            unique=True,
            name="unique_doctor_appointment_slot",
        )
        # TTL index for server-side token revocation
        mongo_db.revoked_tokens.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="ttl_revoked_tokens_expires_at"
        )
        # TTL index for distributed login rate limiter
        mongo_db.login_rate_limits.create_index(
            [("updated_at", 1)],
            expireAfterSeconds=600,
            name="ttl_login_rate_limits_updated_at"
        )
    except Exception:
        # Gracefully tolerate offline or mocked test environments
        pass
