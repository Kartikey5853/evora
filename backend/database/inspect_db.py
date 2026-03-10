import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "lax_ev_stations.db")


def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    print("DB:", DB_PATH, flush=True)
    print(
        "tables:",
        cur.execute("select name from sqlite_master where type='table'").fetchall(),
        flush=True,
    )

    for t in ["chargers", "slots", "stations", "bookings"]:
        try:
            print(f"\n{t} columns:", flush=True)
            cur.execute(f"pragma table_info({t})")
            print(cur.fetchall(), flush=True)
        except Exception as e:
            print("error:", e, flush=True)

    con.close()


if __name__ == "__main__":
    main()
