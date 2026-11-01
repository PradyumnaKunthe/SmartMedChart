"""
SmartMedChart Dedicated Background Medication Notification Worker.

Can be run as an independent Render Background Worker service:
Command: python worker.py

Polls MongoDB periodically to deliver 5-minute pre-dose medication reminders
to assigned nurses. Persists notification state idempotently in MongoDB.
"""

import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load environment
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

from app.mongo_client import mask_mongo_uri, ping_mongodb
from app.services.notification_service import (
    init_notification_indexes,
    process_due_notifications,
)

running = True


def handle_shutdown(signum, frame):
    global running
    print(f"\n[Worker] Received termination signal ({signum}). Shutting down gracefully...")
    running = False


def main():
    global running

    # Register graceful shutdown signals
    signal.signal(signal.SIGINT, handle_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_shutdown)

    interval = int(os.getenv("NOTIFICATION_POLL_INTERVAL", "15"))
    uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    db_name = os.getenv("MONGODB_DATABASE", "smartmedchart")

    print("==================================================")
    print(" SmartMedChart Medication Notification Worker     ")
    print("==================================================")
    print(f"Target Database: {db_name}")
    print(f"Target Cluster:  {mask_mongo_uri(uri)}")
    print(f"Poll Interval:   {interval} seconds")
    print("==================================================")

    # Validate database connectivity
    try:
        ping_mongodb()
        print("[Worker] Successfully connected to MongoDB.")
    except Exception as err:
        print(f"[Worker] Warning: Initial MongoDB ping failed: {err}")

    # Ensure collection indexes
    init_notification_indexes()
    print("[Worker] Notification indexes initialized.")
    print("[Worker] Heartbeat loop started. Press Ctrl+C to stop.")

    while running:
        try:
            delivered = process_due_notifications()
            if delivered:
                now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                print(f"[{now_str}] Delivered {len(delivered)} medication reminder(s).")
        except Exception as err:
            print(f"[Worker Error] Exception in notification loop: {err}")

        # Sleep in small increments for responsive termination
        slept = 0
        while running and slept < interval:
            time.sleep(1)
            slept += 1

    print("[Worker] Notification worker stopped cleanly.")


if __name__ == "__main__":
    main()

