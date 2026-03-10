from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
import math
from dependencies import get_db, get_current_admin
from models.station import Station
from models.charger import Charger
from models.slot import Slot
from schema.station import StationCreate, StationOut
from datetime import datetime, date, time, timedelta
from models.booking import Booking
from models.booking_slot import BookingSlot

router = APIRouter()

def _utcnow() -> datetime:
    return datetime.utcnow()

def cleanup_expired_bookings(db: Session):
    """Legacy helper retained for station routes.

    NOTE: Booking <-> Slot association is via BookingSlot now.
    We no longer try to free slots here; lifecycle/cancel handles it.
    """
    return


def roll_free_slots_forward(db: Session):
    """Roll ended AVAILABLE slots forward by 1 day.

    Uses Slot.status instead of removed Slot.is_available.
    """
    now = _utcnow()
    ended_free_slots = (
        db.query(Slot)
        .filter(
            Slot.end_time <= now,
            Slot.status == "AVAILABLE",
        )
        .all()
    )
    for slot in ended_free_slots:
        slot.start_time = slot.start_time + timedelta(days=1)
        slot.end_time = slot.end_time + timedelta(days=1)
        slot.status = "AVAILABLE"
    if ended_free_slots:
        db.commit()


def haversine_distance(lat1, lng1, lat2, lng2):
    """
    Calculate distance between two lat/lng points in KM
    """
    R = 6371  # Earth radius in KM

    lat1 = math.radians(lat1)
    lng1 = math.radians(lng1)  # fixed: use lng1, not lat1
    lat2 = math.radians(lat2)
    lng2 = math.radians(lng2)

    dlat = lat2 - lat1
    dlng = lng2 - lng1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@router.get("/nearby")
def get_nearby_stations(
    lat: float,
    lng: float,
    db: Session = Depends(get_db)
):
    """
    Returns stations sorted by distance from user location.
    Distance is calculated in KM using Haversine formula.
    """

    stations = db.query(Station).all()
    results = []

    for s in stations:
        try:
            station_lat = float(s.latitude)
            station_lng = float(s.longitude)
        except (TypeError, ValueError):
            continue

        distance = haversine_distance(
            lat, lng, station_lat, station_lng
        )

        supported_charger_types = (
            db.query(Charger.charger_type)
            .filter(Charger.station_id == s.id)
            .distinct()
            .all()
        )

        supported_charger_types = [c[0] for c in supported_charger_types]

        results.append({
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "distance_km": round(distance, 2),
            "supported_charger_types": supported_charger_types,
        })

    # Sort by nearest first
    results.sort(key=lambda x: x["distance_km"])

    return results


@router.get("/")
def get_stations(db: Session = Depends(get_db)):
    stations = db.query(Station).filter(Station.is_active == True).all()

    response = []

    for s in stations:
        # 🔑 DERIVE charger types for this station
        supported_charger_types = (
            db.query(Charger.charger_type)
            .filter(Charger.station_id == s.id)
            .distinct()
            .all()
        )

        supported_charger_types = [c[0] for c in supported_charger_types]

        response.append({
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "supported_charger_types": supported_charger_types,
        })

    return response


@router.get("/{station_id}")
def get_station(station_id: str, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return {
        "id": station.id,
        "name": station.name,
        "address": station.address,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "is_active": station.is_active,
    }


@router.get("/{station_id}/chargers")
def get_station_chargers(station_id: str, db: Session = Depends(get_db)):
    chargers = (
        db.query(Charger)
        .filter(Charger.station_id == station_id)
        .all()
    )
    return [
        {
            "id": c.id,
            "charger_type": c.charger_type,
            "power_kw": c.power_kw,
            "price_per_hour": c.price_per_hour,
        }
        for c in chargers
    ]


@router.get("/{station_id}/chargers-with-slots")
def get_chargers_with_slots(station_id: str, db: Session = Depends(get_db)):
    chargers = (
        db.query(Charger)
        .filter(Charger.station_id == station_id)
        .all()
    )
    charger_ids = [c.id for c in chargers]

    slots = []
    if charger_ids:
        slots = (
            db.query(Slot)
            .filter(Slot.charger_id.in_(charger_ids))
            .order_by(Slot.start_time)
            .all()
        )

    slots_by_charger = {}
    for s in slots:
        slots_by_charger.setdefault(s.charger_id, []).append({
            "id": s.id,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "status": getattr(s, "status", None),
        })

    return [
        {
            "id": c.id,
            "station_id": c.station_id,
            "name": getattr(c, "name", None),
            "charger_type": c.charger_type,
            "power_kw": getattr(c, "power_kw", None),
            "power_output_kw": getattr(c, "power_output_kw", None),
            "price_per_hour": getattr(c, "price_per_hour", None),
            "default_price_30min": getattr(c, "default_price_30min", None),
            "is_active": getattr(c, "is_active", True),
            "slots": slots_by_charger.get(c.id, []),
        }
        for c in chargers
    ]


@router.post("/", response_model=StationOut)
def create_station(
    station: StationCreate,
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    # Always use the authenticated admin's ID as host_id
    db_station = Station(
        name=station.name,
        address=station.address,
        latitude=station.latitude,
        longitude=station.longitude,
        host_id=admin_id,
        is_active=False,
        document_url=station.document_url or None,
        approval_status="PENDING",
    )
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station


@router.get("/{station_id}/availability")
def get_station_availability(
    station_id: str,
    db: Session = Depends(get_db)
):
    """
    Public, read-only availability endpoint.
    Safe for booking flow.
    """

    charger_ids = (
        db.query(Charger.id)
        .filter(Charger.station_id == station_id)
        .all()
    )

    charger_ids = [c[0] for c in charger_ids]

    if not charger_ids:
        return {
            "available_slots": 0,
            "total_slots": 0
        }

    total_slots = (
        db.query(Slot)
        .filter(Slot.charger_id.in_(charger_ids))
        .count()
    )

    now = _utcnow()
    available_slots = (
        db.query(Slot)
        .filter(
            Slot.charger_id.in_(charger_ids),
            Slot.status == "AVAILABLE",
            Slot.end_time >= now,
        )
        .count()
    )

    return {
        "available_slots": available_slots,
        "total_slots": total_slots
    }


@router.get("/{station_id}/slots")
def get_station_slots(
    station_id: str,
    db: Session = Depends(get_db)
):
    """User slot list endpoint.

    Deterministic display:
      - DISABLED if Slot.status==DISABLED
      - EXPIRED if slot.end_time < now (derived, not stored)
      - BOOKED if Slot.status==BOOKED and booking_status==UPCOMING
      - GRACE if Slot.status==GRACE
      - AVAILABLE if Slot.status==AVAILABLE

    recently_released: True if released_at within last 2 minutes.
    """

    # Keep existing regeneration hooks (do not change lifecycle)
    cleanup_expired_bookings(db)
    roll_free_slots_forward(db)

    charger_ids = (
        db.query(Charger.id)
        .filter(Charger.station_id == station_id)
        .all()
    )
    charger_ids_list = [c[0] for c in charger_ids]
    if charger_ids_list:
        ensure_today_slots(db, station_id, charger_ids_list)

    now = _utcnow()
    recent_cutoff = now - timedelta(minutes=2)

    rows = (
        db.query(Slot, Charger, Booking)
        .join(Charger, Slot.charger_id == Charger.id)
        .outerjoin(BookingSlot, BookingSlot.slot_id == Slot.id)
        .outerjoin(Booking, Booking.id == BookingSlot.booking_id)
        .filter(Charger.station_id == station_id)
        .order_by(Slot.start_time)
        .all()
    )

    def display_status(slot: Slot, booking: Booking | None) -> str:
        if slot.status == "DISABLED":
            return "DISABLED"
        if slot.end_time < now:
            return "EXPIRED"
        if slot.status == "BOOKED" and booking and booking.booking_status == "UPCOMING":
            return "BOOKED"
        if slot.status == "GRACE":
            return "GRACE"
        if slot.status == "BOOKED":
            return "BOOKED"
        return "AVAILABLE"

    return [
        {
            "id": slot.id,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "status": display_status(slot, booking),
            "recently_released": bool(getattr(slot, "released_at", None) and slot.released_at >= recent_cutoff),
            "price_per_hour": charger.price_per_hour,
            "charger_type": charger.charger_type,
            "charger_id": charger.id,
        }
        for slot, charger, booking in rows
    ]


@router.post("/{station_id}/slots")
def add_slot_to_station(
    station_id: str,
    slot_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    charger_id = slot_data.get("charger_id")
    start_time_str = slot_data.get("start_time")  # e.g. "08:00"
    end_time_str = slot_data.get("end_time")      # e.g. "09:00"

    if not charger_id or not start_time_str or not end_time_str:
        raise HTTPException(status_code=400, detail="Missing required fields")
    def parse_datetime(value: str) -> datetime:
        try:
            # Case 1: ISO datetime (frontend sends this)
            return datetime.fromisoformat(value)
        except ValueError:
            try:
                # Case 2: HH:MM fallback
                today = date.today()
                return datetime.combine(
                    today,
                    datetime.strptime(value, "%H:%M").time()
                )
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid datetime format"
                )

    start_time = parse_datetime(start_time_str)
    end_time = parse_datetime(end_time_str)

    if end_time <= start_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time"
        )

    new_slot = Slot(
        charger_id=charger_id,
        start_time=start_time,   # ✅ datetime
        end_time=end_time,       # ✅ datetime
        status="AVAILABLE",
    )

    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    return {"id": new_slot.id}


@router.post("/{station_id}/chargers")
def add_charger_to_station(
    station_id: str,
    charger_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    charger_type = charger_data.get("charger_type")
    power_kw = charger_data.get("power_kw")
    if not charger_type or power_kw is None:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Prefer explicit default_price_30min; otherwise derive from price_per_hour
    price_per_hour = charger_data.get("price_per_hour", 100)
    default_price_30min = charger_data.get("default_price_30min")
    if default_price_30min is None:
        try:
            default_price_30min = float(price_per_hour) / 2.0
        except Exception:
            default_price_30min = 0

    new_charger = Charger(
        station_id=station_id,
        name=charger_data.get("name"),
        charger_type=charger_type,
        power_kw=power_kw,
        power_output_kw=float(power_kw) if power_kw is not None else None,
        price_per_hour=price_per_hour,
        default_price_30min=default_price_30min,
    )
    db.add(new_charger)
    db.commit()
    db.refresh(new_charger)
    return {"id": new_charger.id}


@router.put("/{station_id}")
def update_station(station_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    for key in ["name", "address", "latitude", "longitude", "is_active"]:
        if key in data:
            setattr(station, key, data[key])
    db.commit()
    db.refresh(station)
    return {
        "id": station.id,
        "name": station.name,
        "address": station.address,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "is_active": station.is_active,
    }


@router.delete("/chargers/{charger_id}")
def delete_charger(charger_id: str, db: Session = Depends(get_db)):
    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    # delete slots for this charger
    db.query(Slot).filter(Slot.charger_id == charger_id).delete()
    db.delete(charger)
    db.commit()
    return {"deleted": True}


def ensure_today_slots(db: Session, station_id: str, charger_ids: list[str]):
    today = date.today()
    # check if there are slots for today already
    existing_today = (
        db.query(Slot)
        .filter(
            Slot.charger_id.in_(charger_ids),
            Slot.start_time >= datetime.combine(today, time(0,0)),
            Slot.end_time <= datetime.combine(today, time(23,59,59))
        )
        .count()
    )
    if existing_today > 0:
        return
    # get any historical slots to serve as templates (hour ranges)
    templates = (
        db.query(Slot)
        .filter(Slot.charger_id.in_(charger_ids))
        .order_by(Slot.start_time)
        .all()
    )
    hour_ranges_by_charger: dict[str, set[tuple[int,int]]] = {}
    for s in templates:
        start_h = s.start_time.hour
        end_h = s.end_time.hour
        hour_ranges_by_charger.setdefault(s.charger_id, set()).add((start_h, end_h))
    # create today's slots per template
    for cid, ranges in hour_ranges_by_charger.items():
        for (sh, eh) in ranges:
            start_dt = datetime.combine(today, time(sh, 0))
            end_dt = datetime.combine(today, time(eh, 0))
            new_slot = Slot(
                charger_id=cid,
                start_time=start_dt,
                end_time=end_dt,
                status="AVAILABLE",
            )
            db.add(new_slot)
    db.commit()
