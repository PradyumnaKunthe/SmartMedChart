
import argparse
import hashlib
import json
from datetime import date, datetime, time
from decimal import Decimal

from bson.decimal128 import Decimal128
from pymongo import ReplaceOne
from sqlalchemy import inspect, text

from app.database import engine
from app.mongo_client import mongo_db, ping_mongodb


# Database migration metadata is not application data.
EXCLUDED_TABLES = {"alembic_version"}


def to_bson_value(value):
    """Convert Python values into BSON-compatible values."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, Decimal):
        return Decimal128(value)

    if isinstance(value, dict):
        return {
            str(key): to_bson_value(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [to_bson_value(item) for item in value]

    return value


def stable_value(value):
    """Make a value suitable for deterministic document IDs."""
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, bytes):
        return value.hex()

    if isinstance(value, dict):
        return {
            str(key): stable_value(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [stable_value(item) for item in value]

    return value


def make_document(row, primary_key_columns):
    """Preserve original database IDs and relationship fields."""
    document = {
        key: to_bson_value(value)
        for key, value in row.items()
        if key != "_id"
    }

    if len(primary_key_columns) == 1:
        # Keep the original ID as MongoDB's document ID.
        original_id = row[primary_key_columns[0]]

        if original_id is None:
            raise ValueError("A primary key value is unexpectedly null.")

        document["_id"] = to_bson_value(original_id)

    elif primary_key_columns:
        # Handle composite keys, such as role_permissions.
        key_values = [
            stable_value(row[column])
            for column in primary_key_columns
        ]
        canonical_key = json.dumps(
            key_values,
            sort_keys=True,
            separators=(",", ":"),
        )
        document["_id"] = "composite:" + canonical_key

    else:
        # Fallback for a table without a declared primary key.
        canonical_row = json.dumps(
            stable_value(row),
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        document["_id"] = (
            "sha256:"
            + hashlib.sha256(
                canonical_row.encode("utf-8")
            ).hexdigest()
        )

    return document


def main():
    parser = argparse.ArgumentParser(
        description="Copy SQLite application data to MongoDB."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the migrated documents to MongoDB.",
    )
    args = parser.parse_args()

    print("Checking MongoDB connection...")
    ping_mongodb()
    print(f"Connected to database: {mongo_db.name}")

    inspector = inspect(engine)

    tables = sorted(
        table
        for table in inspector.get_table_names()
        if table not in EXCLUDED_TABLES
    )

    plans = []

    # Read SQLite and prepare the migration plan.
    with engine.connect() as connection:
        for table in tables:
            primary_key_columns = (
                inspector.get_pk_constraint(table)
                .get("constrained_columns")
                or []
            )

            result = connection.execute(
                text(f'SELECT * FROM "{table}"')
            )

            rows = [
                dict(row)
                for row in result.mappings()
            ]

            documents = [
                make_document(row, primary_key_columns)
                for row in rows
            ]

            collection = mongo_db[table]
            existing_count = collection.count_documents({})

            plans.append(
                (
                    table,
                    primary_key_columns,
                    documents,
                    existing_count,
                )
            )

    print("\n========== MIGRATION PLAN ==========")

    total_rows = 0

    for table, keys, documents, existing_count in plans:
        total_rows += len(documents)

        print(
            f"{table}: "
            f"{len(documents)} SQLite rows -> "
            f"{mongo_db[table].name} "
            f"(currently {existing_count} documents)"
        )

    print(f"\nTotal SQLite records to copy: {total_rows}")

    if not args.apply:
        print("\nDRY RUN ONLY — nothing was written.")
        print(
            "Review the plan, then rerun with --apply "
            "to perform the migration."
        )
        return

    print("\n========== COPYING RECORDS ==========")

    for table, keys, documents, existing_count in plans:
        if not documents:
            print(f"{table}: no rows to copy")
            continue

        operations = [
            ReplaceOne(
                {"_id": document["_id"]},
                document,
                upsert=True,
            )
            for document in documents
        ]

        # MongoDB bulk writes are idempotent for these stable IDs.
        mongo_db[table].bulk_write(
            operations,
            ordered=False,
        )

        migrated_count = mongo_db[table].count_documents({})

        print(
            f"{table}: processed {len(documents)} rows; "
            f"MongoDB now contains {migrated_count} documents"
        )

    print("\nMigration copy completed.")
    print(
        "SQLite has not been deleted or modified. "
        "Verify document counts and references before "
        "switching application routes to MongoDB."
    )


if __name__ == "__main__":
    main()
