#!/usr/bin/env python3
"""
SmartMedChart – MongoDB Atlas Initialization Utility
===================================================

This script safely and idempotently initializes a fresh MongoDB Atlas (or local)
database for SmartMedChart deployment.

Safety Features:
- DRY-RUN BY DEFAULT: Shows what would be changed without writing to the database.
- EXPLICIT CONFIRMATION: Writing requires both --apply and --db <database_name>.
- IDEMPOTENT: Checks for existing roles, permissions, and indexes before creating.
- SAFE CREDENTIALS: Never prints connection strings or secrets.
- SECURE ADMIN CREATION: Uses Argon2id password hashing; refuses to overwrite
  existing administrators; enforces minimum 8-character passwords.
- NON-DESTRUCTIVE: Never drops, resets, or overwrites existing patient/user records.

Usage Examples:
  # 1. Preview changes (safe dry-run):
  python init_mongodb_atlas.py

  # 2. Apply initialization to production cluster:
  python init_mongodb_atlas.py --apply --db smartmedchart_production

  # 3. Apply initialization and create the first administrator interactively:
  python init_mongodb_atlas.py --apply --db smartmedchart_production --create-admin

  # 4. Include clean demonstration medicine catalog (for college demo):
  python init_mongodb_atlas.py --apply --db smartmedchart_production --seed-demo-catalog
"""

import argparse
import getpass
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

# Load environment from backend/.env or system environment
ENV_FILE = BACKEND_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

try:
    from app.security import hash_password
except ImportError:
    # Standalone fallback if app.security is not reachable directly
    from pwdlib import PasswordHash
    _pwd_hash = PasswordHash.recommended()
    def hash_password(p: str) -> str:
        return _pwd_hash.hash(p)


# ==============================================================================
# Canonical System Definitions
# ==============================================================================

CANONICAL_ROLES = [
    {
        "id": 1,
        "name": "Doctor",
        "description": "Can prescribe and manage patient medications.",
    },
    {
        "id": 2,
        "name": "Nurse",
        "description": "Can view medication tasks and record medication administration.",
    },
    {
        "id": 3,
        "name": "Pharmacist",
        "description": "Can perform relevant medicine and pharmacy activities.",
    },
    {
        "id": 4,
        "name": "Administrator",
        "description": "Can manage users, permissions, reports, and system settings.",
    },
    {
        "id": 5,
        "name": "Receptionist",
        "description": "Can view patient information and register patients for CareMatch.",
    },
]

CANONICAL_PERMISSIONS = [
    {"id": 1, "name": "VIEW_PATIENT", "description": "View patient information"},
    {"id": 2, "name": "CREATE_PRESCRIPTION", "description": "Create a medication prescription"},
    {"id": 3, "name": "EDIT_PRESCRIPTION", "description": "Modify an existing prescription"},
    {"id": 4, "name": "STOP_PRESCRIPTION", "description": "Stop an active prescription"},
    {"id": 5, "name": "VIEW_MEDICATION_HISTORY", "description": "View medication administration history"},
    {"id": 6, "name": "VIEW_MEDICATION_SCHEDULE", "description": "View medication schedules"},
    {"id": 7, "name": "VERIFY_QR", "description": "Verify a patient using QR"},
    {"id": 8, "name": "ADMINISTER_MEDICATION", "description": "Record medication administration"},
    {"id": 9, "name": "VIEW_PRESCRIPTION", "description": "View prescriptions"},
    {"id": 10, "name": "MANAGE_MEDICINE", "description": "Manage medicine information"},
    {"id": 11, "name": "MANAGE_INVENTORY", "description": "Manage medicine inventory"},
    {"id": 12, "name": "MANAGE_USERS", "description": "Create and manage users"},
    {"id": 13, "name": "MANAGE_ROLES", "description": "Manage user roles"},
    {"id": 14, "name": "MANAGE_PERMISSIONS", "description": "Manage permissions"},
    {"id": 15, "name": "VIEW_REPORTS", "description": "View hospital reports"},
    {"id": 16, "name": "VIEW_AUDIT_LOG", "description": "View audit logs"},
    {"id": 17, "name": "MANAGE_SYSTEM", "description": "Manage system settings"},
    {"id": 18, "name": "REGISTER_PATIENT", "description": "Register new patients and initiate encounters"},
]

CANONICAL_ROLE_PERMISSIONS = {
    "Doctor": [
        "VIEW_PATIENT",
        "CREATE_PRESCRIPTION",
        "EDIT_PRESCRIPTION",
        "STOP_PRESCRIPTION",
        "VIEW_MEDICATION_HISTORY",
        "VIEW_MEDICATION_SCHEDULE",
    ],
    "Nurse": [
        "VIEW_PATIENT",
        "VIEW_MEDICATION_HISTORY",
        "VIEW_MEDICATION_SCHEDULE",
        "VERIFY_QR",
        "ADMINISTER_MEDICATION",
    ],
    "Pharmacist": [
        "VIEW_PATIENT",
        "VIEW_PRESCRIPTION",
        "MANAGE_MEDICINE",
        "MANAGE_INVENTORY",
    ],
    "Administrator": [
        "VIEW_PATIENT",
        "VIEW_MEDICATION_SCHEDULE",
        "MANAGE_USERS",
        "MANAGE_ROLES",
        "MANAGE_PERMISSIONS",
        "VIEW_REPORTS",
        "VIEW_AUDIT_LOG",
        "MANAGE_SYSTEM",
        "REGISTER_PATIENT",
    ],
    "Receptionist": [
        "VIEW_PATIENT",
        "REGISTER_PATIENT",
    ],
}

DEMO_MEDICINES = [
    {
        "id": 1,
        "name": "Paracetamol 500mg",
        "generic_name": "Paracetamol",
        "strength": "500 mg",
        "dosage_form": "Tablet",
        "description": "Antipyretic and analgesic for pain and fever management.",
        "is_active": 1,
    },
    {
        "id": 2,
        "name": "Amoxicillin 500mg",
        "generic_name": "Amoxicillin",
        "strength": "500 mg",
        "dosage_form": "Capsule",
        "description": "Broad-spectrum beta-lactam antibiotic.",
        "is_active": 1,
    },
    {
        "id": 3,
        "name": "Metformin 500mg",
        "generic_name": "Metformin Hydrochloride",
        "strength": "500 mg",
        "dosage_form": "Tablet",
        "description": "First-line biguanide oral antihyperglycemic medication.",
        "is_active": 1,
    },
    {
        "id": 4,
        "name": "Atorvastatin 20mg",
        "generic_name": "Atorvastatin Calcium",
        "strength": "20 mg",
        "dosage_form": "Tablet",
        "description": "HMG-CoA reductase inhibitor for lipid and cardiovascular management.",
        "is_active": 1,
    },
    {
        "id": 5,
        "name": "Omeprazole 20mg",
        "generic_name": "Omeprazole",
        "strength": "20 mg",
        "dosage_form": "Delayed-Release Capsule",
        "description": "Proton pump inhibitor for gastroprotection and acid reflux.",
        "is_active": 1,
    },
]


# ==============================================================================
# Helper Functions
# ==============================================================================

def mask_uri(uri: str) -> str:
    """Mask credentials in MongoDB connection string for safe console display."""
    if not uri:
        return "<empty>"
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", uri)


def get_next_sequence_value(db, collection_name: str) -> int:
    """Safe sequence generator matching app.mongo_client implementation."""
    latest = db[collection_name].find_one(sort=[("_id", -1)])
    maximum = int(latest["_id"]) if latest and isinstance(latest.get("_id"), int) else 0

    counters = db["_id_sequences"]
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


# ==============================================================================
# Core Initializer Class
# ==============================================================================

class MongoAtlasInitializer:
    def __init__(self, uri: str, db_name: str, apply_changes: bool = False):
        self.uri = uri
        self.db_name = db_name
        self.apply_changes = apply_changes
        self.client = None
        self.db = None
        self.actions_log = []

    def connect(self):
        print(f"[*] Connecting to MongoDB: {mask_uri(self.uri)}")
        print(f"[*] Target database: {self.db_name}")
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.client.admin.command("ping")
            self.db = self.client[self.db_name]
            print("[OK] Successfully connected to MongoDB.")
        except ConnectionFailure as err:
            print(f"[ERROR] Failed to connect to MongoDB: {err}")
            sys.exit(1)
        except Exception as err:
            print(f"[ERROR] Unexpected error connecting to database: {err}")
            sys.exit(1)

    def init_roles(self):
        print("\n--- Auditing Roles ---")
        existing_roles = {r["name"].lower(): r for r in self.db.roles.find()}
        created_count = 0

        for r_def in CANONICAL_ROLES:
            key = r_def["name"].lower()
            if key in existing_roles:
                existing = existing_roles[key]
                print(f"  [=] Role '{r_def['name']}' already exists (ID: {existing.get('id', existing.get('_id'))}).")
            else:
                print(f"  [+] Role '{r_def['name']}' needs creation.")
                if self.apply_changes:
                    role_id = r_def["id"]
                    # If this ID is already taken by another role, use auto-sequence
                    if self.db.roles.find_one({"_id": role_id}):
                        role_id = get_next_sequence_value(self.db, "roles")
                    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                    doc = {
                        "_id": role_id,
                        "id": role_id,
                        "name": r_def["name"],
                        "description": r_def["description"],
                        "created_at": now_str,
                        "updated_at": now_str,
                    }
                    self.db.roles.insert_one(doc)
                    existing_roles[key] = doc
                    created_count += 1
                    print(f"      [OK] Created role '{r_def['name']}' with ID {role_id}.")

        self.actions_log.append(f"Roles: {created_count} created, {len(existing_roles)} existing.")

    def init_permissions(self):
        print("\n--- Auditing Permissions ---")
        existing_perms = {p["name"].upper(): p for p in self.db.permissions.find()}
        created_count = 0

        for p_def in CANONICAL_PERMISSIONS:
            key = p_def["name"].upper()
            if key in existing_perms:
                existing = existing_perms[key]
                print(f"  [=] Permission '{p_def['name']}' exists (ID: {existing.get('id', existing.get('_id'))}).")
            else:
                print(f"  [+] Permission '{p_def['name']}' needs creation.")
                if self.apply_changes:
                    perm_id = p_def["id"]
                    if self.db.permissions.find_one({"_id": perm_id}):
                        perm_id = get_next_sequence_value(self.db, "permissions")
                    doc = {
                        "_id": perm_id,
                        "id": perm_id,
                        "name": p_def["name"],
                        "description": p_def["description"],
                    }
                    self.db.permissions.insert_one(doc)
                    existing_perms[key] = doc
                    created_count += 1
                    print(f"      [OK] Created permission '{p_def['name']}' with ID {perm_id}.")

        self.actions_log.append(f"Permissions: {created_count} created, {len(existing_perms)} existing.")

    def init_role_permissions(self):
        print("\n--- Auditing Role-Permission Mappings ---")
        roles_by_name = {r["name"].lower(): r for r in self.db.roles.find()}
        perms_by_name = {p["name"].upper(): p for p in self.db.permissions.find()}

        existing_links = set()
        for link in self.db.role_permissions.find():
            existing_links.add((link.get("role_id"), link.get("permission_id")))

        created_count = 0
        for role_name, perm_list in CANONICAL_ROLE_PERMISSIONS.items():
            role_doc = roles_by_name.get(role_name.lower())
            if not role_doc:
                print(f"  [!] Cannot map permissions: Role '{role_name}' does not exist in DB yet.")
                continue

            role_id = role_doc.get("id", role_doc.get("_id"))
            for perm_name in perm_list:
                perm_doc = perms_by_name.get(perm_name.upper())
                if not perm_doc:
                    print(f"  [!] Cannot map permission: Permission '{perm_name}' does not exist in DB yet.")
                    continue

                perm_id = perm_doc.get("id", perm_doc.get("_id"))
                if (role_id, perm_id) in existing_links:
                    continue  # Already mapped

                print(f"  [+] Mapping role '{role_name}' (ID {role_id}) -> '{perm_name}' (ID {perm_id}).")
                if self.apply_changes:
                    next_id = get_next_sequence_value(self.db, "role_permissions")
                    self.db.role_permissions.insert_one({
                        "_id": next_id,
                        "id": next_id,
                        "role_id": role_id,
                        "permission_id": perm_id,
                    })
                    existing_links.add((role_id, perm_id))
                    created_count += 1

        print(f"  [=] Role-Permission links active: {len(existing_links)} total ({created_count} newly created).")
        self.actions_log.append(f"Role-Permissions: {created_count} new mappings added.")

    def init_indexes(self):
        print("\n--- Auditing Required Indexes ---")
        index_specs = [
            ("users", [("username", 1)], {"unique": True, "name": "idx_users_username"}),
            ("users", [("email", 1)], {"unique": True, "sparse": True, "name": "idx_users_email"}),
            ("roles", [("name", 1)], {"unique": True, "name": "idx_roles_name"}),
            ("roles", [("id", 1)], {"unique": True, "sparse": True, "name": "idx_roles_id"}),
            ("permissions", [("name", 1)], {"unique": True, "name": "idx_permissions_name"}),
            ("permissions", [("id", 1)], {"unique": True, "sparse": True, "name": "idx_permissions_id"}),
            ("role_permissions", [("role_id", 1), ("permission_id", 1)], {"unique": True, "name": "idx_role_perm_pair"}),
            ("patients", [("patient_id", 1)], {"unique": True, "sparse": True, "name": "idx_patients_pid"}),
            ("prescriptions", [("id", 1)], {"unique": True, "sparse": True, "name": "idx_prescriptions_id"}),
            ("prescription_items", [("id", 1)], {"unique": True, "sparse": True, "name": "idx_prescription_items_id"}),
            ("wards", [("name", 1)], {"name": "idx_wards_name"}),
            ("beds", [("ward_id", 1), ("bed_number", 1)], {"unique": True, "name": "idx_beds_ward_bed"}),
            ("medication_notifications", [("medication_schedule_id", 1), ("notification_type", 1)], {"unique": True, "sparse": True, "name": "idx_notif_sched_type"}),
            ("medication_notifications", [("recipient_nurse_id", 1), ("read", 1)], {"name": "idx_notif_recipient_read"}),
            ("medication_notifications", [("scheduled_datetime", 1)], {"name": "idx_notif_scheduled_datetime"}),
        ]

        created_indexes = 0
        for coll_name, keys, options in index_specs:
            idx_name = options.get("name", str(keys))
            existing_idx_names = [i["name"] for i in self.db[coll_name].list_indexes()] if coll_name in self.db.list_collection_names() else []
            if idx_name in existing_idx_names:
                print(f"  [=] Index '{idx_name}' exists on collection '{coll_name}'.")
            else:
                print(f"  [+] Index '{idx_name}' on collection '{coll_name}' needs creation.")
                if self.apply_changes:
                    try:
                        self.db[coll_name].create_index(keys, **options)
                        created_indexes += 1
                        print(f"      [OK] Created index '{idx_name}' on '{coll_name}'.")
                    except OperationFailure as err:
                        print(f"      [!] Warning creating index '{idx_name}': {err}")

        self.actions_log.append(f"Indexes: {created_indexes} indexes created.")

    def seed_demo_catalog(self):
        print("\n--- Seeding Demonstration Medicine Catalog (Optional) ---")
        existing_medicines = {m["name"].lower(): m for m in self.db.medicines.find()}
        added_count = 0

        for med in DEMO_MEDICINES:
            key = med["name"].lower()
            if key in existing_medicines:
                print(f"  [=] Medicine '{med['name']}' already exists.")
            else:
                print(f"  [+] Medicine '{med['name']}' needs creation.")
                if self.apply_changes:
                    med_id = get_next_sequence_value(self.db, "medicines")
                    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                    doc = dict(med)
                    doc["_id"] = med_id
                    doc["id"] = med_id
                    doc["created_at"] = now_str
                    doc["updated_at"] = now_str
                    self.db.medicines.insert_one(doc)
                    added_count += 1
                    print(f"      [OK] Inserted demo medicine '{med['name']}' (ID: {med_id}).")

        self.actions_log.append(f"Demo Medicines: {added_count} added.")

    def create_admin_user(self, username=None, email=None, full_name=None, password=None):
        print("\n--- Administrator Account Setup ---")
        admin_role = self.db.roles.find_one({"name": {"$regex": "^Administrator$", "$options": "i"}})
        if not admin_role:
            print("[ERROR] Error: Administrator role not found in database. Run initialization first.")
            return False

        admin_role_id = admin_role.get("id", admin_role.get("_id"))
        existing_admin = self.db.users.find_one({"role_id": admin_role_id, "is_active": {"$in": [1, True]}})
        if existing_admin:
            print(f"[!] An active Administrator already exists: username='{existing_admin.get('username')}'")
            print("[!] Refusing to overwrite existing Administrator for security.")
            return False

        # Gather admin details if not supplied
        if not username:
            username = input("Enter new Administrator username [default: admin]: ").strip() or "admin"
        if not email:
            email = input("Enter new Administrator email [e.g. admin@smartmedchart.org]: ").strip() or "admin@smartmedchart.org"
        if not full_name:
            full_name = input("Enter Administrator Full Name [default: System Administrator]: ").strip() or "System Administrator"

        # Password collection
        if not password:
            while True:
                p1 = getpass.getpass("Enter Administrator password (min 8 characters): ")
                if len(p1) < 8:
                    print("[!] Password must be at least 8 characters long. Please try again.")
                    continue
                p2 = getpass.getpass("Confirm Administrator password: ")
                if p1 != p2:
                    print("[!] Passwords do not match. Please try again.")
                    continue
                password = p1
                break
        elif len(password) < 8:
            print("[ERROR] Provided password is less than 8 characters. Aborting.")
            return False

        if not self.apply_changes:
            print(f"[DRY-RUN] Would create Administrator account:")
            print(f"          Username : {username}")
            print(f"          Email    : {email}")
            print(f"          Name     : {full_name}")
            print(f"          Role ID  : {admin_role_id} (Administrator)")
            return True

        admin_id = get_next_sequence_value(self.db, "users")
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        admin_doc = {
            "_id": admin_id,
            "id": admin_id,
            "username": username,
            "email": email,
            "full_name": full_name,
            "password_hash": hash_password(password),
            "role_id": admin_role_id,
            "is_active": True,
            "created_at": now_str,
            "updated_at": now_str,
        }
        self.db.users.insert_one(admin_doc)
        print(f"[OK] Administrator '{username}' created successfully (ID: {admin_id}).")
        self.actions_log.append(f"Administrator account '{username}' created.")
        return True


# ==============================================================================
# CLI Entry Point
# ==============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="SmartMedChart MongoDB Atlas Database Initializer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--uri",
        default=os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017"),
        help="MongoDB connection URI (defaults to MONGODB_URI environment variable)",
    )
    parser.add_argument(
        "--db",
        default=os.getenv("MONGODB_DATABASE", "smartmedchart_dev"),
        help="Target database name (defaults to MONGODB_DATABASE environment variable)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually execute database changes (without this flag, runs in safe DRY-RUN mode)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicitly run in dry-run mode without making any database changes (default behavior)",
    )
    parser.add_argument(
        "--create-admin",
        action="store_true",
        help="Prompt to securely create the first system administrator account",
    )
    parser.add_argument(
        "--seed-demo-catalog",
        action="store_true",
        help="Seed standard demonstration medicines (Paracetamol, Amoxicillin, etc.) for the college demo",
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip interactive confirmation prompt when --apply is used",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    print("=" * 70)
    print(" SmartMedChart – MongoDB Atlas Database Initializer")
    print("=" * 70)

    if not args.apply:
        print("\n>>> RUNNING IN SAFE DRY-RUN MODE (NO WRITES WILL BE PERFORMED) <<<")
        print("To apply changes, provide: --apply --db <target_database_name>\n")
    else:
        print(f"\n[!] CAUTION: --apply is active. Changes WILL be written to database '{args.db}'.")
        if not args.yes:
            confirm = input(f"Confirm initialization of database '{args.db}'? Type 'yes' to proceed: ").strip()
            if confirm.lower() != "yes":
                print("[!] Operation aborted by user.")
                sys.exit(0)

    initializer = MongoAtlasInitializer(
        uri=args.uri,
        db_name=args.db,
        apply_changes=args.apply,
    )
    initializer.connect()
    initializer.init_roles()
    initializer.init_permissions()
    initializer.init_role_permissions()
    initializer.init_indexes()

    if args.seed_demo_catalog:
        initializer.seed_demo_catalog()

    if args.create_admin:
        initializer.create_admin_user()

    print("\n" + "=" * 70)
    print(" SUMMARY OF ACTIONS")
    print("=" * 70)
    for log_item in initializer.actions_log:
        print(f" - {log_item}")

    if not args.apply:
        print("\n[NOTE] Dry-run completed. No database changes were committed.")
        print("Run with '--apply --db <database_name>' to execute these changes.")
    else:
        print("\n[OK] Database initialization complete and ready for application deployment.")


if __name__ == "__main__":
    main()
