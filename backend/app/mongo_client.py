import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# Load the backend/.env file
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://127.0.0.1:27017",
)

MONGODB_DATABASE = os.getenv(
    "MONGODB_DATABASE",
    "smartmedchart",
)

# Create the MongoDB client
mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
)

# Select the SmartMedChart database
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