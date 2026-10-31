"""Read-only cross-database foreign-key reference comparison for SmartMedChart.

Run from the backend directory:
    python migration_relationship_compare.py

The report contains collection/table names, field names, counts, and numeric IDs
only. It never prints patient names, clinical values, credentials, or the MongoDB
connection URI. Neither database is modified.
"""
from __future__ import annotations

import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any

from bson import ObjectId
from app.mongo_client import mongo_db, ping_mongodb

DB_PATH = Path(__file__).resolve().parent / "smartmedchart.db"


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def norm(value: Any) -> tuple[str, str]:
    if isinstance(value, bool):
        return ("bool", str(value))
    if isinstance(value, int):
        return ("number", str(value))
    if isinstance(value, float):
        return ("number", str(value))
    if isinstance(value, ObjectId):
        return ("objectid", str(value))
    if value is None:
        return ("null", "")
    return (type(value).__name__, str(value))


def display_ids(values: set[tuple[str, str]], limit: int = 30) -> str:
    numeric = sorted({int(v) for kind, v in values if kind == "number"})
    other_count = sum(1 for kind, _ in values if kind != "number")
    parts: list[str] = []
    if numeric:
        parts.append(", ".join(str(v) for v in numeric[:limit]) + (" ..." if len(numeric) > limit else ""))
    if other_count:
        parts.append(f"{other_count} non-numeric value(s) hidden")
    return "; ".join(parts) if parts else "(none)"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"SQLite database not found: {DB_PATH}")

    print("=== SMARTMEDCHART CROSS-DATABASE RELATIONSHIP CHECK (READ ONLY) ===")
    print(f"SQLite file: {DB_PATH}")
    ping_mongodb()
    print("MongoDB connection: OK")

    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        mongo_names = set(mongo_db.list_collection_names())

        # SQLite PRAGMA rows are grouped by FK id so composite constraints can
        # be identified and safely skipped rather than misinterpreted.
        constraints: list[tuple[str, list[sqlite3.Row]]] = []
        for child in sorted(tables):
            fk_rows = list(conn.execute(f"PRAGMA foreign_key_list({qident(child)})"))
            grouped: dict[int, list[sqlite3.Row]] = defaultdict(list)
            for fk in fk_rows:
                grouped[fk["id"]].append(fk)
            for fk_id, parts in grouped.items():
                constraints.append((child, sorted(parts, key=lambda r: r["seq"])))

        print("\n--- Foreign-key comparison ---")
        checked = 0
        skipped = 0
        total_sql_orphans = 0
        total_mongo_orphans = 0

        for child, parts in constraints:
            if len(parts) != 1:
                skipped += 1
                print(f"\n{child}: composite foreign key ({len(parts)} columns); safely skipped")
                continue

            fk = parts[0]
            child_col = fk["from"]
            parent = fk["table"]
            parent_col = fk["to"]
            if child_col is None or parent_col is None:
                skipped += 1
                print(f"\n{child}: incomplete FK metadata; safely skipped")
                continue

            checked += 1
            sql_child_vals = {
                norm(row[0])
                for row in conn.execute(
                    f"SELECT DISTINCT {qident(child_col)} FROM {qident(child)} "
                    f"WHERE {qident(child_col)} IS NOT NULL"
                )
            }
            sql_parent_vals = {
                norm(row[0])
                for row in conn.execute(f"SELECT DISTINCT {qident(parent_col)} FROM {qident(parent)}")
            } if parent in tables else set()
            sql_orphans = sql_child_vals - sql_parent_vals

            mongo_child_vals: set[tuple[str, str]] = set()
            mongo_parent_vals: set[tuple[str, str]] = set()
            child_in_mongo = child in mongo_names
            parent_in_mongo = parent in mongo_names
            if child_in_mongo:
                try:
                    mongo_child_vals = {
                        norm(v) for v in mongo_db[child].distinct(child_col, {child_col: {"$ne": None}})
                        if v is not None
                    }
                except Exception:
                    mongo_child_vals = set()
            if parent_in_mongo:
                try:
                    mongo_parent_vals = {
                        norm(v) for v in mongo_db[parent].distinct(parent_col)
                        if v is not None
                    }
                except Exception:
                    mongo_parent_vals = set()

            mongo_orphans = mongo_child_vals - mongo_parent_vals if child_in_mongo and parent_in_mongo else set()
            total_sql_orphans += len(sql_orphans)
            total_mongo_orphans += len(mongo_orphans)

            # For each orphan on one side, check if the referenced parent exists
            # on the other side. This helps distinguish a missing migration from
            # an already-broken source relationship.
            sql_orphan_parent_in_mongo = sql_orphans & mongo_parent_vals
            mongo_orphan_parent_in_sqlite = mongo_orphans & sql_parent_vals

            print(f"\n{child}.{child_col} -> {parent}.{parent_col}")
            print(f"  SQLite distinct refs={len(sql_child_vals)} | SQLite orphan refs={len(sql_orphans)}")
            if sql_orphans:
                print(f"  SQLite orphan IDs: {display_ids(sql_orphans)}")
                print(
                    "  Of those, parent IDs present in MongoDB: "
                    f"{display_ids(sql_orphan_parent_in_mongo)}"
                )
            if child_in_mongo and parent_in_mongo:
                print(f"  MongoDB distinct refs={len(mongo_child_vals)} | MongoDB orphan refs={len(mongo_orphans)}")
                if mongo_orphans:
                    print(f"  MongoDB orphan IDs: {display_ids(mongo_orphans)}")
                    print(
                        "  Of those, parent IDs present in SQLite: "
                        f"{display_ids(mongo_orphan_parent_in_sqlite)}"
                    )
            else:
                missing = []
                if not child_in_mongo:
                    missing.append(f"child collection {child} missing")
                if not parent_in_mongo:
                    missing.append(f"parent collection {parent} missing")
                print("  MongoDB check unavailable: " + "; ".join(missing))

        print("\n--- Summary ---")
        print(f"Single-column FK relationships checked: {checked}")
        print(f"Composite/incomplete FK relationships skipped: {skipped}")
        print(f"SQLite orphan reference values (summed by FK): {total_sql_orphans}")
        print(f"MongoDB orphan reference values (summed by FK): {total_mongo_orphans}")
        print("\nCompleted. Read-only; no records were changed.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
