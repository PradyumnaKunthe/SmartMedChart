"""Read-only SmartMedChart SQLite <-> MongoDB ID comparison.

Run from the backend directory:
    python migration_compare.py

This script prints schema/ID diagnostics only. It does not print patient data,
credentials, MongoDB URI, or modify either database.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter
from typing import Any

from bson import ObjectId
from app.mongo_client import mongo_db, ping_mongodb

DB_PATH = Path(__file__).resolve().parent / "smartmedchart.db"


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def normalized(value: Any) -> tuple[str, str]:
    # Treat BSON integer widths and Python ints as the same logical ID type.
    if isinstance(value, bool):
        return ("bool", str(value))
    if isinstance(value, int):
        return ("int", str(value))
    if isinstance(value, ObjectId):
        return ("ObjectId", str(value))
    if value is None:
        return ("null", "None")
    return (type(value).__name__, str(value))


def short_values(values: list[Any], limit: int = 20) -> str:
    # Print numeric IDs only; never print string-valued primary keys, which
    # could be usernames or other identifying information.
    numeric = sorted({int(v) for v in values if isinstance(v, int) and not isinstance(v, bool)})
    if not numeric:
        return f"{len(values)} non-numeric/mixed ID(s) (values hidden)"
    shown = numeric[:limit]
    suffix = " ..." if len(numeric) > limit else ""
    return ", ".join(map(str, shown)) + suffix


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"SQLite database not found: {DB_PATH}")

    print("=== SMARTMEDCHART SQLITE / MONGODB ID COMPARISON (READ ONLY) ===")
    print(f"SQLite file: {DB_PATH}")
    ping_mongodb()
    print("MongoDB connection: OK")

    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        print("\n--- Primary-key comparison ---")
        for table in tables:
            if table == "alembic_version":
                print(f"\n{table}: skipped (SQLite migration metadata)")
                continue

            info = list(conn.execute(f"PRAGMA table_info({qident(table)})"))
            pk_columns = [r["name"] for r in sorted(info, key=lambda x: x["pk"]) if r["pk"]]
            columns = [r["name"] for r in info]
            if not pk_columns:
                print(f"\n{table}: no declared primary key; columns={columns}")
                continue

            select_cols = ", ".join(qident(c) for c in pk_columns)
            sql_rows = conn.execute(f"SELECT {select_cols} FROM {qident(table)}").fetchall()
            sql_keys = [tuple(normalized(row[c]) for c in pk_columns) for row in sql_rows]
            sql_counter = Counter(sql_keys)

            if table not in mongo_db.list_collection_names():
                print(f"\n{table}: SQLite={len(sql_rows)}, MongoDB collection=MISSING")
                continue

            collection = mongo_db[table]
            docs = list(collection.find({}, {"_id": 1, **{c: 1 for c in pk_columns}, "id": 1}))
            doc_keys: list[tuple[tuple[str, str], ...]] = []
            method = None
            missing_key_docs = 0

            # Prefer exact SQL primary-key field names, then conventional `id`.
            if docs and all(all(c in d for c in pk_columns) for d in docs):
                method = ",".join(pk_columns)
                doc_keys = [tuple(normalized(d[c]) for c in pk_columns) for d in docs]
            elif pk_columns == ["id"] and docs and all("id" in d for d in docs):
                method = "id"
                doc_keys = [(normalized(d["id"]),) for d in docs]
            elif pk_columns == ["id"] and docs and all("_id" in d and not isinstance(d["_id"], ObjectId) for d in docs):
                method = "_id (non-ObjectId)"
                doc_keys = [(normalized(d["_id"]),) for d in docs]
            else:
                missing_key_docs = sum(
                    1 for d in docs if not all(c in d for c in pk_columns) and not (len(pk_columns) == 1 and "id" in d)
                )
                field_samples = sorted({k for d in docs[:10] for k in d.keys()})
                print(
                    f"\n{table}: SQLite={len(sql_rows)}, MongoDB={len(docs)}, "
                    f"cannot safely match primary key {pk_columns}; docs lacking a comparable key={missing_key_docs}; "
                    f"sample field names={field_samples}"
                )
                continue

            mongo_counter = Counter(doc_keys)
            sql_set, mongo_set = set(sql_counter), set(mongo_counter)
            only_sql = list(sql_set - mongo_set)
            only_mongo = list(mongo_set - sql_set)
            duplicate_sql = sum(n - 1 for n in sql_counter.values() if n > 1)
            duplicate_mongo = sum(n - 1 for n in mongo_counter.values() if n > 1)

            print(f"\n{table}: SQLite={len(sql_rows)}, MongoDB={len(docs)}, matched by={method}")
            print(f"  Common IDs: {len(sql_set & mongo_set)} | SQLite-only: {len(only_sql)} | MongoDB-only: {len(only_mongo)}")
            print(f"  Duplicate PKs: SQLite={duplicate_sql}, MongoDB={duplicate_mongo}")
            if only_sql:
                vals = [tuple_part[1] if tuple_part[0] == "int" else tuple_part for key in only_sql for tuple_part in key]
                if all(isinstance(v, str) and v.lstrip("-").isdigit() for v in vals):
                    print("  IDs present only in SQLite: " + short_values([int(v) for v in vals]))
                else:
                    print("  SQLite-only primary-key values are non-numeric; values hidden")
            if only_mongo:
                vals = [tuple_part[1] if tuple_part[0] == "int" else tuple_part for key in only_mongo for tuple_part in key]
                if all(isinstance(v, str) and v.lstrip("-").isdigit() for v in vals):
                    print("  IDs present only in MongoDB: " + short_values([int(v) for v in vals]))
                else:
                    print("  MongoDB-only primary-key values are non-numeric; values hidden")

        print("\n--- SQLite foreign-key integrity ---")
        fk_errors = list(conn.execute("PRAGMA foreign_key_check"))
        print(f"Foreign-key violations: {len(fk_errors)}")
        if fk_errors:
            grouped = Counter(row[0] for row in fk_errors)
            for table, count in sorted(grouped.items()):
                print(f"  {table}: {count}")

        mongo_names = set(mongo_db.list_collection_names())
        sql_names = set(tables) - {"alembic_version"}
        extras = sorted(mongo_names - sql_names)
        print("\n--- MongoDB-only collections (preserve these) ---")
        print(", ".join(extras) if extras else "None")

    finally:
        conn.close()

    print("\nCompleted. No records were changed.")


if __name__ == "__main__":
    main()
