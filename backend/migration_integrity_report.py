"""Read-only SmartMedChart SQLite foreign-key diagnostics.

Run from the backend directory:
    python migration_integrity_report.py

Reports broken SQLite FK references as table/rowid/column/ID only. It does not
print patient names, clinical data, credentials, MongoDB URI, or modify data.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter, defaultdict
from typing import Any

DB_PATH = Path(__file__).resolve().parent / "smartmedchart.db"


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def safe_value(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(value)
    return f"<{type(value).__name__} value hidden>"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"SQLite database not found: {DB_PATH}")

    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        print("=== SMARTMEDCHART SQLITE FOREIGN-KEY DIAGNOSTICS (READ ONLY) ===")
        print(f"SQLite file: {DB_PATH}")
        fk_errors = list(conn.execute("PRAGMA foreign_key_check"))
        print(f"Total foreign-key violations: {len(fk_errors)}")

        if not fk_errors:
            print("No SQLite foreign-key violations found.")
        else:
            grouped = Counter(row["table"] for row in fk_errors)
            print("\n--- Violations by table ---")
            for table, count in sorted(grouped.items()):
                print(f"{table}: {count}")

            print("\n--- Exact broken references (no clinical values) ---")
            schema_cache: dict[str, dict[int, list[sqlite3.Row]]] = {}
            for table in sorted(grouped):
                fk_rows = list(conn.execute(f"PRAGMA foreign_key_list({qident(table)})"))
                by_id: dict[int, list[sqlite3.Row]] = defaultdict(list)
                for fk in fk_rows:
                    by_id[fk["id"]].append(fk)
                schema_cache[table] = by_id

            for err in fk_errors:
                table, rowid, parent, fkid = err["table"], err["rowid"], err["parent"], err["fkid"]
                fk_parts = schema_cache.get(table, {}).get(fkid, [])
                if not fk_parts:
                    print(f"{table} rowid={rowid}: references missing parent in {parent} (FK details unavailable)")
                    continue
                mappings = []
                for fk in sorted(fk_parts, key=lambda r: r["seq"]):
                    child_col, parent_col = fk["from"], fk["to"]
                    try:
                        result = conn.execute(
                            f"SELECT {qident(child_col)} FROM {qident(table)} WHERE rowid = ?", (rowid,)
                        ).fetchone()
                        value = result[0] if result else None
                    except sqlite3.Error:
                        value = None
                    mappings.append(f"{child_col}={safe_value(value)} -> {parent}.{parent_col}")
                print(f"{table} rowid={rowid}: " + "; ".join(mappings))

            print("\n--- Foreign-key definitions for affected tables ---")
            for table in sorted(grouped):
                print(f"{table}:")
                fk_rows = list(conn.execute(f"PRAGMA foreign_key_list({qident(table)})"))
                for fk in fk_rows:
                    print(
                        f"  {fk['from']} -> {fk['table']}.{fk['to']} "
                        f"(on_delete={fk['on_delete']}, on_update={fk['on_update']})"
                    )

        print("\nCompleted. No records were changed.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
