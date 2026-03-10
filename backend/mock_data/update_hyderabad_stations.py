"""Update the current SQLite DB to have Hyderabad stations.

Run:
  python -m mock_data.update_hyderabad_stations

What it does:
- Updates existing Station rows to Hyderabad locations (first N mapped to the list below)
- Inserts additional stations until there are 10 Hyderabad stations
- Ensures each station has at least 1 charger (creates one if missing)

This is meant for dev/demo data.
"""

from __future__ import annotations

import uuid
from datetime import datetime, UTC

from sqlalchemy.orm import Session

from database.database import SessionLocal, engine
from models import base  # noqa: F401 ensures Base metadata
import models  # noqa: F401 ensures models registered

from models.host import Host
from models.station import Station
from models.charger import Charger


HYDERABAD_STATIONS: list[dict[str, str]] = [
    {
        "name": "Hanisha EV station",
        "address": "Uppal, Hyderabad, Telangana",
        "latitude": "17.4065",
        "longitude": "78.5591",
    },
    {
        "name": "Srikanth EV station",
        "address": "LB Nagar, Hyderabad, Telangana",
        "latitude": "17.3456",
        "longitude": "78.5522",
    },
    {
        "name": "Gachibowli FastCharge Point",
        "address": "Gachibowli, Hyderabad, Telangana",
        "latitude": "17.4401",
        "longitude": "78.3489",
    },
    {
        "name": "Madhapur EV Plaza",
        "address": "Madhapur, Hyderabad, Telangana",
        "latitude": "17.4483",
        "longitude": "78.3915",
    },
    {
        "name": "Kondapur Charge Hub",
        "address": "Kondapur, Hyderabad, Telangana",
        "latitude": "17.4686",
        "longitude": "78.3570",
    },
    {
        "name": "Kukatpally EV Stop",
        "address": "Kukatpally, Hyderabad, Telangana",
        "latitude": "17.4948",
        "longitude": "78.3996",
    },
    {
        "name": "Secunderabad Charge Station",
        "address": "Secunderabad, Hyderabad, Telangana",
        "latitude": "17.4399",
        "longitude": "78.4983",
    },
    {
        "name": "Begumpet EV Charging Bay",
        "address": "Begumpet, Hyderabad, Telangana",
        "latitude": "17.4375",
        "longitude": "78.4496",
    },
    {
        "name": "Banjara Hills EV Hub",
        "address": "Banjara Hills, Hyderabad, Telangana",
        "latitude": "17.4126",
        "longitude": "78.4480",
    },
    {
        "name": "Dilsukhnagar QuickCharge",
        "address": "Dilsukhnagar, Hyderabad, Telangana",
        "latitude": "17.3680",
        "longitude": "78.5310",
    },
]


def _get_or_create_host(db: Session) -> Host:
    host = db.query(Host).first()
    if host:
        return host

    host = Host(
        id=str(uuid.uuid4()),
        name="Demo Host",
        email="admin@evora.dev",
        password_hash="admin",
        is_verified=True,
    )
    db.add(host)
    db.commit()
    db.refresh(host)
    return host


def _ensure_charger_for_station(db: Session, station_id: str) -> None:
    existing = db.query(Charger).filter(Charger.station_id == station_id).first()
    if existing:
        return

    db.add(
        Charger(
            id=str(uuid.uuid4()),
            station_id=station_id,
            name="Charger 1",
            charger_type="CCS2",
            power_kw="60",
            power_output_kw=60.0,
            default_price_30min=90.0,
            is_active=True,
            created_at=datetime.now(UTC),
        )
    )


def update_db() -> None:
    base.Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        host = _get_or_create_host(db)

        stations = db.query(Station).order_by(Station.created_at.asc()).all()

        # Update existing stations (move them to Hyderabad)
        for idx, station in enumerate(stations):
            if idx < len(HYDERABAD_STATIONS):
                data = HYDERABAD_STATIONS[idx]
                station.name = data["name"]
                station.address = data["address"]
                station.latitude = data["latitude"]
                station.longitude = data["longitude"]
            else:
                station.address = "Hyderabad, Telangana"

            station.host_id = host.id
            station.is_active = True

        db.commit()

        # Insert until we have 10 stations
        if len(stations) < len(HYDERABAD_STATIONS):
            for idx in range(len(stations), len(HYDERABAD_STATIONS)):
                data = HYDERABAD_STATIONS[idx]
                db.add(
                    Station(
                        id=str(uuid.uuid4()),
                        host_id=host.id,
                        name=data["name"],
                        address=data["address"],
                        latitude=data["latitude"],
                        longitude=data["longitude"],
                        is_active=True,
                    )
                )
            db.commit()

        # Ensure chargers exist (useful for the UI/API)
        all_stations = db.query(Station).all()
        for station in all_stations:
            _ensure_charger_for_station(db, station.id)
        db.commit()

        print(f"✅ Updated stations: {db.query(Station).count()}")
        print("✅ Hyderabad station names:")
        for s in db.query(Station).order_by(Station.created_at.asc()).limit(10).all():
            print(f"- {s.name} | {s.address} | {s.latitude},{s.longitude}")

    finally:
        db.close()


def main() -> None:
    update_db()


if __name__ == "__main__":
    main()
