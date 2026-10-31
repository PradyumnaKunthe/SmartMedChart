import sqlite3
import json
from pathlib import Path
from app.mongo_client import mongo_db, ping_mongodb

DB_PATH = Path(__file__).parent / "smartmedchart.db"

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def main():
    print("=== SQLITE TO MONGODB DRY RUN ===")

    ping_mongodb()
    print("MongoDB connection: OK")

    connection = sqlite3.connect(
        DB_PATH.resolve().as_uri() + "?mode=ro",
        uri=True
    )
    connection.row_factory = sqlite3.Row

    tables = connection.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name != 'alembic_version'
        ORDER BY name
    """).fetchall()

    total_source = 0
    total_existing = 0
    total_missing = 0

    try:
        for table_row in tables:
            table = table_row["name"]

            columns = connection.execute(
                f"PRAGMA table_info({quote(table)})"
            ).fetchall()

            primary_keys = sorted(
                [c for c in columns if c["pk"] > 0],
                key=lambda c: c["pk"]
            )

            if not primary_keys:
                raise RuntimeError(
                    f"{table} has no primary key. Stopping."
                )

            rows = connection.execute(
                f"SELECT * FROM {quote(table)}"
            ).fetchall()

            collection = mongo_db[table]
            existing = 0
            missing = 0

            for row in rows:
                document = dict(row)
                identity = {}

                for column in columns:
                    name = column["name"]
                    value = document[name]
                    data_type = (column["type"] or "").upper()

                    if value is not None and "BOOL" in data_type:
                        document[name] = bool(value)

                    elif value is not None and "JSON" in data_type:
                        try:
                            document[name] = json.loads(value)
                        except (ValueError, TypeError):
                            pass

                for key in primary_keys:
                    identity[key["name"]] = document[key["name"]]

                matches = collection.count_documents(
                    identity, limit=2
                )

                if matches > 1:
                    raise RuntimeError(
                        f"Duplicate MongoDB identity in {table}: {identity}"
                    )
                elif matches == 1:
                    existing += 1
                else:
                    missing += 1

            total_source += len(rows)
            total_existing += existing
            total_missing += missing

            print(
                f"{table}: SQLite={len(rows)}, "
                f"MongoDB matches={existing}, missing={missing}"
            )

        print("\n=== SUMMARY ===")
        print("SQLite records:", total_source)
        print("Existing MongoDB matches:", total_existing)
        print("Records needing insertion:", total_missing)
        print("\nDRY RUN COMPLETE.")
        print("NO DATABASE RECORDS WERE CHANGED.")

    finally:
        connection.close()

if __name__ == "__main__":
    main()