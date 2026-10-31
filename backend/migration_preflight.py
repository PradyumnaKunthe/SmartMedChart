from __future__ import annotations

import sqlite3
from pathlib import Path


def main() -> int:
    backend_dir = Path(__file__).resolve().parent
    sqlite_path = backend_dir / "smartmedchart.db"

    print("=== SMARTMEDCHART DATABASE PREFLIGHT (READ ONLY) ===")
    print(f"SQLite file: {sqlite_path}")
    if not sqlite_path.exists():
        print("ERROR: smartmedchart.db was not found beside this script.")
        print("Place this script in the backend folder and run it there.")
        return 1

    try:
        with sqlite3.connect(f"file:{sqlite_path.as_posix()}?mode=ro", uri=True) as conn:
            tables = [
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name NOT LIKE 'sqlite_%' "
                    "ORDER BY name"
                )
            ]
            print("\n--- SQLite tables and row counts ---")
            for table in tables:
                quoted = '"' + table.replace('"', '""') + '"'
                count = conn.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0]
                print(f"{table}: {count}")
            print(f"TOTAL SQLITE TABLES: {len(tables)}")
    except Exception as exc:
        print(f"SQLite inventory failed: {type(exc).__name__}: {exc}")
        return 1

    print("\n--- MongoDB collections and document counts ---")
    try:
        # Import uses the existing backend/app/mongo_client.py and backend/.env.
        from app.mongo_client import mongo_db, ping_mongodb

        ping_mongodb()
        collection_names = sorted(mongo_db.list_collection_names())
        if not collection_names:
            print("(no collections found)")
        for name in collection_names:
            count = mongo_db[name].count_documents({})
            print(f"{name}: {count}")
        print(f"TOTAL MONGODB COLLECTIONS: {len(collection_names)}")
    except Exception as exc:
        print(
            "MongoDB inventory unavailable: "
            f"{type(exc).__name__}: {exc}"
        )
        print("SQLite inventory completed; check MongoDB service and backend/.env.")

    print("\nNo records were read into the output or changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
