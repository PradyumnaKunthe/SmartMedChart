"""Read-only SmartMedChart migration schema and SQL-dependency audit.

Place this file in the backend folder, beside smartmedchart.db, then run:
    python migration_schema_audit.py

The script prints schema metadata, MongoDB field names/types, selected broken
reference IDs, and counts of SQLAlchemy-related code patterns. It never prints
patient/user field values, credentials, connection strings, or document contents.
It does not insert, update, delete, or modify either database.
"""
from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent
SQLITE_PATH = BACKEND_DIR / "smartmedchart.db"
APP_DIR = BACKEND_DIR / "app"


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sqlite_schema(conn: sqlite3.Connection) -> list[str]:
    output: list[str] = []
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    output.append(f"SQLite tables discovered: {len(tables)}")
    for table in tables:
        qtable = quote_identifier(table)
        columns = list(conn.execute(f"PRAGMA table_info({qtable})"))
        fks = list(conn.execute(f"PRAGMA foreign_key_list({qtable})"))
        indexes = list(conn.execute(f"PRAGMA index_list({qtable})"))
        col_parts = []
        for col in columns:
            # PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
            _cid, name, dtype, notnull, _default, pk = col
            flags = []
            if pk:
                flags.append(f"PK#{pk}")
            flags.append("NOT NULL" if notnull else "NULLABLE")
            col_parts.append(f"{name} [{dtype or 'UNDECLARED'}; {', '.join(flags)}]")
        output.append(f"\n{table}:")
        output.append("  Columns: " + "; ".join(col_parts))
        if fks:
            fk_parts = []
            for fk in fks:
                # id, seq, table, from, to, on_update, on_delete, match
                _id, _seq, parent, child_col, parent_col, on_update, on_delete, _match = fk
                fk_parts.append(
                    f"{child_col}->{parent}.{parent_col} (on_delete={on_delete}, on_update={on_update})"
                )
            output.append("  Foreign keys: " + "; ".join(fk_parts))
        if indexes:
            idx_parts = []
            for idx in indexes:
                # seq, name, unique, origin, partial
                _seq, idx_name, unique, origin, partial = idx
                idx_cols = [r[2] for r in conn.execute(f"PRAGMA index_info({quote_identifier(idx_name)})")]
                idx_parts.append(
                    f"{idx_name}({', '.join(c or '?' for c in idx_cols)})"
                    f" {'UNIQUE' if unique else 'NON-UNIQUE'}"
                    f" [origin={origin}, partial={partial}]"
                )
            output.append("  Indexes: " + "; ".join(idx_parts))
    return output


def type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, (bytes, bytearray)):
        return "bytes"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def collect_paths(doc: dict[str, Any], prefix: str = "", depth: int = 0):
    for key, value in doc.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        yield path, type_name(value)
        if isinstance(value, dict) and depth < 2:
            yield from collect_paths(value, path, depth + 1)
        elif isinstance(value, list) and value and depth < 2:
            # Inspect at most the first few elements' structure/types, never values.
            elem_types = sorted({type_name(item) for item in value[:10]})
            yield f"{path}[]", "|".join(elem_types)
            for item in value[:10]:
                if isinstance(item, dict):
                    yield from collect_paths(item, f"{path}[]", depth + 1)


def mongo_schema() -> list[str]:
    output: list[str] = []
    try:
        from app.mongo_client import mongo_db, ping_mongodb

        ping_mongodb()
    except Exception as exc:
        return [f"MongoDB connection/import failed: {type(exc).__name__}: {exc}"]

    names = sorted(mongo_db.list_collection_names())
    output.append(f"MongoDB collections discovered: {len(names)}")
    for name in names:
        collection = mongo_db[name]
        field_types: dict[str, set[str]] = defaultdict(set)
        present_counts: dict[str, int] = defaultdict(int)
        doc_count = 0
        # Existing dataset is small; stream docs and emit only key/type metadata.
        for doc in collection.find({}):
            doc_count += 1
            for path, kind in collect_paths(doc):
                field_types[path].add(kind)
                present_counts[path] += 1
        fields = []
        for path in sorted(field_types):
            kinds = "|".join(sorted(field_types[path]))
            fields.append(f"{path}<{kinds}>[{present_counts[path]}/{doc_count}]")
        output.append(f"\n{name}: documents={doc_count}")
        output.append("  Fields: " + ("; ".join(fields) if fields else "(empty collection)"))
        try:
            idx_parts = []
            for idx in collection.list_indexes():
                key_doc = idx.get("key", {})
                key_text = ", ".join(f"{k}:{v}" for k, v in key_doc.items())
                idx_parts.append(
                    f"{idx.get('name')}({key_text}){' UNIQUE' if idx.get('unique') else ''}"
                )
            output.append("  Indexes: " + "; ".join(idx_parts))
        except Exception as exc:
            output.append(f"  Indexes: unavailable ({type(exc).__name__})")
    return output


def affected_reference_rows(conn: sqlite3.Connection) -> list[str]:
    output = ["--- Rows involved in known broken-reference groups (IDs only) ---"]
    specs = {
        "patients": ("id", ["ward_id", "bed_id"]),
        "medication_schedules": ("id", ["administered_by"]),
        "qr_verifications": ("id", ["verified_by"]),
    }
    for table, (pk, refs) in specs.items():
        cols = [pk] + refs
        qcols = ", ".join(quote_identifier(c) for c in cols)
        rows = conn.execute(f"SELECT {qcols} FROM {quote_identifier(table)} ORDER BY {quote_identifier(pk)}").fetchall()
        output.append(f"{table}: {len(rows)} rows scanned")
        # Only show rows where the relevant reference is non-null and unresolved.
        for row in rows:
            record = dict(zip(cols, row))
            broken = []
            for ref in refs:
                value = record[ref]
                if value is None:
                    continue
                parent = {"ward_id": "wards", "bed_id": "beds", "administered_by": "users", "verified_by": "users"}[ref]
                exists = conn.execute(
                    f"SELECT 1 FROM {quote_identifier(parent)} WHERE id=? LIMIT 1", (value,)
                ).fetchone()
                if not exists:
                    broken.append(f"{ref}={value}")
            if broken:
                output.append(f"  {pk}={record[pk]}: " + ", ".join(broken))
    return output


def code_dependency_audit() -> list[str]:
    output = ["--- SQL / SQLAlchemy dependency scan (file names and counts only) ---"]
    patterns = {
        "sqlalchemy_import": ("from sqlalchemy", "import sqlalchemy"),
        "sessionlocal": ("SessionLocal",),
        "get_db": ("get_db",),
        "depends_db": ("Depends(get_db)",),
        "db_query": ("db.query(",),
        "db_add": ("db.add(",),
        "db_commit": ("db.commit(",),
        "db_refresh": ("db.refresh(",),
        "db_delete": ("db.delete(",),
        "database_url": ("DATABASE_URL",),
        "base_metadata": ("Base.metadata",),
    }
    roots = [APP_DIR, BACKEND_DIR]
    files: set[Path] = set()
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            if any(part in {".venv", "venv", "__pycache__", "site-packages", "alembic"} for part in path.parts):
                continue
            if path.name.startswith("migration_"):
                continue
            files.add(path)
    hits = 0
    for path in sorted(files):
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        counts = {}
        for label, needles in patterns.items():
            count = sum(1 for line in lines if any(needle in line for needle in needles))
            if count:
                counts[label] = count
        if counts:
            rel = path.relative_to(BACKEND_DIR)
            output.append(f"{rel}: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
            hits += 1
    output.append(f"Files with SQL-related patterns: {hits}")
    return output


def main() -> None:
    print("=== SMARTMEDCHART READ-ONLY SCHEMA / CUTOVER AUDIT ===")
    print(f"Backend folder: {BACKEND_DIR}")
    print(f"SQLite file: {SQLITE_PATH}")
    if not SQLITE_PATH.exists():
        raise SystemExit("ERROR: smartmedchart.db was not found beside this script.")

    uri = f"file:{SQLITE_PATH.as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        conn.row_factory = sqlite3.Row
        for line in sqlite_schema(conn):
            print(line)
        print("\n" + "\n".join(affected_reference_rows(conn)))

    print("\n--- MongoDB collection field and index audit (field names/types only) ---")
    for line in mongo_schema():
        print(line)

    print("\n" + "\n".join(code_dependency_audit()))
    print("\nCompleted. Read-only; no database records or application files were changed.")


if __name__ == "__main__":
    main()
