import sqlite3

connection = sqlite3.connect("smartmedchart.db")

tables = connection.execute(
    "SELECT name FROM sqlite_master "
    "WHERE type='table' "
    "ORDER BY name"
).fetchall()

print("Database tables:")
for table in tables:
    print("-", table[0])

connection.close()