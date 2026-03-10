"""Hackathon reset: delete SQLite DB and seed a clean coherent dataset.

Run:
  python -m mock_data.reset_and_seed

This will:
- delete backend/lax_ev_stations.db
- create tables
- seed: 1 admin(host), 2 users, 2 stations, chargers, and 3 days of 10-min slots

"""

import os
from datetime import datetime, UTC

from database.database import DB_PATH, engine, SessionLocal
from models import base  # noqa: F401
import models  # noqa: F401

from models.host import Host
from models.user import User
from models.station import Station
from models.charger import Charger


HYDERABAD_STATIONS = [
    {
        "id": "station-1",
        "name": "Hanisha EV station",
        "address": "Uppal, Hyderabad, Telangana",
        "latitude": "17.4065",
        "longitude": "78.5591",
    },
    {
        "id": "station-2",
        "name": "Srikanth EV station",
        "address": "LB Nagar, Hyderabad, Telangana",
        "latitude": "17.3456",
        "longitude": "78.5522",
    },
    {
        "id": "station-3",
        "name": "Gachibowli FastCharge Point",
        "address": "Gachibowli, Hyderabad, Telangana",
        "latitude": "17.4401",
        "longitude": "78.3489",
    },
    {
        "id": "station-4",
        "name": "Madhapur EV Plaza",
        "address": "Madhapur, Hyderabad, Telangana",
        "latitude": "17.4483",
        "longitude": "78.3915",
    },
    {
        "id": "station-5",
        "name": "Kondapur Charge Hub",
        "address": "Kondapur, Hyderabad, Telangana",
        "latitude": "17.4686",
        "longitude": "78.3570",
    },
    {
        "id": "station-6",
        "name": "Kukatpally EV Stop",
        "address": "Kukatpally, Hyderabad, Telangana",
        "latitude": "17.4948",
        "longitude": "78.3996",
    },
    {
        "id": "station-7",
        "name": "Secunderabad Charge Station",
        "address": "Secunderabad, Hyderabad, Telangana",
        "latitude": "17.4399",
        "longitude": "78.4983",
    },
    {
        "id": "station-8",
        "name": "Begumpet EV Charging Bay",
        "address": "Begumpet, Hyderabad, Telangana",
        "latitude": "17.4375",
        "longitude": "78.4496",
    },
    {
        "id": "station-9",
        "name": "Banjara Hills EV Hub",
        "address": "Banjara Hills, Hyderabad, Telangana",
        "latitude": "17.4126",
        "longitude": "78.4480",
    },
    {
        "id": "station-10",
        "name": "Dilsukhnagar QuickCharge",
        "address": "Dilsukhnagar, Hyderabad, Telangana",
        "latitude": "17.3680",
        "longitude": "78.5310",
    },
]


def reset_db_file():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"✅ Deleted DB: {DB_PATH}")


def seed():
    db = SessionLocal()

    # Admin (Host)
    admin = Host(
        id="admin-host-1",
        name="Admin",
        email="admin@evora.dev",
        password_hash="admin",
        is_verified=True,
    )
    db.add(admin)

    # Users (for booking layer later)
    u1 = User(
        id="user-1",
        name="Demo User",
        email="user1@evora.dev",
        password_hash="user",
        is_verified=True,
        is_profile_complete=True,
    )
    u2 = User(
        id="user-2",
        name="Second User",
        email="user2@evora.dev",
        password_hash="user",
        is_verified=True,
        is_profile_complete=True,
    )
    db.add_all([u1, u2])

    # Stations (Hyderabad)
    stations = [
        Station(
            id=s["id"],
            host_id=admin.id,
            name=s["name"],
            address=s["address"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            is_active=True,
        )
        for s in HYDERABAD_STATIONS
    ]

    db.add_all(stations)
    db.commit()

    # Chargers (at least 1 per station)
    chargers = []
    for idx, station in enumerate(stations, start=1):
        # Keep a mix of charger types/power for demo
        charger_type = "CCS2" if idx % 3 != 0 else "Type2"
        power_output_kw = 60.0 if charger_type == "CCS2" else 22.0
        default_price_30min = 90.0 if charger_type == "CCS2" else 45.0

        chargers.append(
            Charger(
                id=f"charger-{idx}",
                station_id=station.id,
                name=f"Charger {idx}",
                charger_type=charger_type,
                power_kw=str(int(power_output_kw)),
                power_output_kw=power_output_kw,
                default_price_30min=default_price_30min,
                is_active=True,
                created_at=datetime.now(UTC),
            )
        )

    db.add_all(chargers)
    db.commit()

    # Generate 3 days slots for each charger using the same function as API (import route handler)
    from routes.slots import generate_3days
    from schema.slot_engine import SlotGenerateRequest

    payload = SlotGenerateRequest(open_time="06:00", close_time="22:00")

    for charger in chargers:
        generate_3days(charger_id=charger.id, payload=payload, db=db)

    db.close()
    print("✅ Seed complete")


def main():
    reset_db_file()
    base.Base.metadata.create_all(bind=engine)
    seed()


if __name__ == "__main__":
    main()
