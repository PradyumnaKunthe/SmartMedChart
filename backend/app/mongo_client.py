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
