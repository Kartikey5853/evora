"""
Migration script: Add emergency vehicle system columns.

Run once to add new columns to existing SQLite tables:
  - cars: is_emergency, emergency_type, emergency_proof_url, emergency_status
  - slots: is_emergency_slot
  - bookings: was_overridden, overridden_by_booking_id

Safe to run multiple times — each ALTER is wrapped in try/except.
"""

import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "lax_ev_stations.db")


def _add_column(cursor: sqlite3.Cursor, table: str, column: str, col_type: str, default=None):
    try:
        default_clause = f" DEFAULT {default}" if default is not None else ""
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"
        cursor.execute(sql)
        print(f"  ✓ Added {table}.{column}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"  – {table}.{column} already exists, skipping")
        else:
            raise


def migrate():
    print(f"Migrating database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Cars table — emergency fields
    _add_column(cur, "cars", "is_emergency", "BOOLEAN", 0)
    _add_column(cur, "cars", "emergency_type", "VARCHAR", "NULL")
    _add_column(cur, "cars", "emergency_proof_url", "VARCHAR", "NULL")
    _add_column(cur, "cars", "emergency_status", "VARCHAR", "NULL")

    # Slots table — emergency slot flag
    _add_column(cur, "slots", "is_emergency_slot", "BOOLEAN", 0)

    # Bookings table — override tracking
    _add_column(cur, "bookings", "was_overridden", "BOOLEAN", 0)
    _add_column(cur, "bookings", "overridden_by_booking_id", "VARCHAR", "NULL")

    conn.commit()
    conn.close()
    print("Migration complete ✓")


if __name__ == "__main__":
    migrate()
