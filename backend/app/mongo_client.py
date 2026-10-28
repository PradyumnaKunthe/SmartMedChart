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