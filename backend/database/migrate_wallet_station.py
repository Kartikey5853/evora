"""
Migration: Add wallet_balance to users/hosts, document_url/approval_status to stations.
Safe for SQLite: checks if column exists before adding.
"""
from database.database import engine
from sqlalchemy import text, inspect


def migrate():
    insp = inspect(engine)

    with engine.connect() as conn:
        # --- users.wallet_balance ---
        user_cols = [c["name"] for c in insp.get_columns("users")]
        if "wallet_balance" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0.0"))
            print("[MIGRATE] Added users.wallet_balance")

        # --- hosts.wallet_balance ---
        host_cols = [c["name"] for c in insp.get_columns("hosts")]
        if "wallet_balance" not in host_cols:
            conn.execute(text("ALTER TABLE hosts ADD COLUMN wallet_balance REAL DEFAULT 0.0"))
            print("[MIGRATE] Added hosts.wallet_balance")

        # --- stations.document_url ---
        station_cols = [c["name"] for c in insp.get_columns("stations")]
        if "document_url" not in station_cols:
            conn.execute(text("ALTER TABLE stations ADD COLUMN document_url TEXT"))
            print("[MIGRATE] Added stations.document_url")

        if "approval_status" not in station_cols:
            conn.execute(text("ALTER TABLE stations ADD COLUMN approval_status TEXT DEFAULT 'APPROVED'"))
            print("[MIGRATE] Added stations.approval_status (default APPROVED for existing)")

        conn.commit()
    print("[MIGRATE] wallet + station approval migration done.")


if __name__ == "__main__":
    migrate()
