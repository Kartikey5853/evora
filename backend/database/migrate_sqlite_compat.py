import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "lax_ev_stations.db")

# Minimal, hackathon-safe migrations: add missing columns used by the new code.
MIGRATIONS: list[str] = [
    # chargers: new columns
    "ALTER TABLE chargers ADD COLUMN name VARCHAR",
    "ALTER TABLE chargers ADD COLUMN power_output_kw FLOAT",
    "ALTER TABLE chargers ADD COLUMN default_price_30min FLOAT",
    "ALTER TABLE chargers ADD COLUMN is_active BOOLEAN DEFAULT 1",
    "ALTER TABLE chargers ADD COLUMN created_at DATETIME",

    # slots: truth layer columns
    "ALTER TABLE slots ADD COLUMN status VARCHAR DEFAULT 'AVAILABLE'",
    "ALTER TABLE slots ADD COLUMN price_override FLOAT",
    "ALTER TABLE slots ADD COLUMN released_at DATETIME",
    "ALTER TABLE slots ADD COLUMN created_at DATETIME",

    # bookings: lifecycle fields
    "ALTER TABLE bookings ADD COLUMN booking_status VARCHAR DEFAULT 'UPCOMING'",
]


def _table_exists(cur: sqlite3.Cursor, table: str) -> bool:
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    return cur.fetchone() is not None


def _column_exists(cur: sqlite3.Cursor, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cur.fetchall()]
    return column in cols


def run():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # Apply each migration only if needed.
    def ensure(table: str, column: str, ddl: str) -> bool:
        if not _table_exists(cur, table):
            return False
        if _column_exists(cur, table, column):
            return False
        try:
            print(f"Applying: {ddl}")
            cur.execute(ddl)
            con.commit()  # commit per-column so a later failure doesn't lose work
            return True
        except Exception as e:
            print(f"[WARN] Failed migration: {ddl} -> {e}")
            return False

    changed = False
    changed |= ensure("chargers", "name", MIGRATIONS[0])
    changed |= ensure("chargers", "power_output_kw", MIGRATIONS[1])
    changed |= ensure("chargers", "default_price_30min", MIGRATIONS[2])
    changed |= ensure("chargers", "is_active", MIGRATIONS[3])
    changed |= ensure("chargers", "created_at", MIGRATIONS[4])

    changed |= ensure("slots", "status", MIGRATIONS[5])
    changed |= ensure("slots", "price_override", MIGRATIONS[6])
    changed |= ensure("slots", "released_at", MIGRATIONS[7])
    changed |= ensure("slots", "created_at", MIGRATIONS[8])

    changed |= ensure("bookings", "booking_status", MIGRATIONS[9])

    if changed:
        print("✅ Migration complete")
    else:
        print("✅ No migration needed")

    con.close()


if __name__ == "__main__":
    run()
