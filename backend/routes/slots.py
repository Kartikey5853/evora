from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, time

from dependencies import get_db
from models.slot import Slot
from models.charger import Charger
from models.booking import Booking
from models.car import Car
from models.user import User
from models.station import Station
from models.booking_slot import BookingSlot
from services.admin_query_service import get_admin_bookings_grouped

from schema.slot_engine import SlotGenerateRequest, SlotWindowOut, SlotOut, SlotPatchRequest

router = APIRouter(prefix="/slots", tags=["slots"])

RECENTLY_RELEASED_MINUTES = 2


def _parse_hhmm(val: str) -> time:
    try:
        hh, mm = val.split(":")
        return time(hour=int(hh), minute=int(mm))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid time format, use HH:MM")


def _utcnow() -> datetime:
    return datetime.utcnow()


def _slot_display_status(slot: Slot, now: datetime, booking_status: str | None = None) -> str:
    """Derive the display status for a slot per the spec:

    1. DISABLED → disabled
    2. end_time < now → expired (derived, never stored)
    3. BOOKED + booking UPCOMING → booked
    4. GRACE → grace
    5. AVAILABLE → available
    """
    if slot.status == "DISABLED":
        return "DISABLED"
    if slot.end_time < now:
        return "EXPIRED"
    if slot.status == "BOOKED" and booking_status == "UPCOMING":
        return "BOOKED"
    if slot.status == "GRACE":
        return "GRACE"
    if slot.status == "BOOKED":
        return "BOOKED"
    return "AVAILABLE"


def _is_recently_released(slot: Slot, now: datetime) -> bool:
    if not slot.released_at:
        return False
    return slot.released_at >= now - timedelta(minutes=RECENTLY_RELEASED_MINUTES)


# ── Slot generation ───────────────────────────────────────────────

@router.post("/generate-3days/{charger_id}")
def generate_3days(charger_id: str, payload: SlotGenerateRequest, db: Session = Depends(get_db)):
    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    open_t = _parse_hhmm(payload.open_time)
    close_t = _parse_hhmm(payload.close_time)

    created = 0
    now = _utcnow()

    price_override = getattr(payload, "price_override", None)

    for day_offset in range(0, 3):
        day = (now + timedelta(days=day_offset)).date()
        start_dt = datetime.combine(day, open_t)
        end_dt = datetime.combine(day, close_t)
        if end_dt <= start_dt:
            raise HTTPException(status_code=400, detail="close_time must be after open_time")

        cursor = start_dt
        while cursor < end_dt:
            slot_end = cursor + timedelta(minutes=10)
            if slot_end > end_dt:
                break

            exists = (
                db.query(Slot)
                .filter(
                    Slot.charger_id == charger_id,
                    Slot.start_time == cursor,
                    Slot.end_time == slot_end,
                )
                .first()
            )
            if not exists:
                db.add(
                    Slot(
                        charger_id=charger_id,
                        start_time=cursor,
                        end_time=slot_end,
                        status="AVAILABLE",
                        price_override=price_override,
                    )
                )
                created += 1

            cursor = slot_end

    db.commit()
    return {"ok": True, "created": created}


# ── User-facing slot windows ─────────────────────────────────────

@router.get("/windows", response_model=list[SlotWindowOut])
def get_windows(charger_id: str, date: str, db: Session = Depends(get_db)):
    try:
        day = datetime.strptime(date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    start_dt = datetime.combine(day, time.min)
    end_dt = datetime.combine(day, time.max)
    now = _utcnow()

    raw_slots: list[Slot] = (
        db.query(Slot)
        .filter(
            Slot.charger_id == charger_id,
            Slot.start_time >= start_dt,
            Slot.start_time <= end_dt,
        )
        .order_by(Slot.start_time, Slot.end_time, Slot.id)
        .all()
    )

    if not raw_slots:
        return []

    # De-duplicate by (start_time, end_time) — prefer AVAILABLE
    by_range: dict[tuple[datetime, datetime], Slot] = {}
    for s in raw_slots:
        key = (s.start_time, s.end_time)
        cur = by_range.get(key)
        if cur is None:
            by_range[key] = s
        elif s.status == "AVAILABLE" and cur.status != "AVAILABLE":
            by_range[key] = s

    slots = sorted(by_range.values(), key=lambda x: x.start_time)

    # Fetch the charger so we can use default_price_30min as fallback
    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    default_per_micro = float(charger.default_price_30min or 0) / 3.0 if charger else 0.0

    windows: list[SlotWindowOut] = []
    i = 0
    while i + 2 < len(slots):
        chunk = slots[i : i + 3]

        if not (
            chunk[0].end_time == chunk[1].start_time
            and chunk[1].end_time == chunk[2].start_time
        ):
            i += 1
            continue

        window_end = chunk[-1].end_time

        # Compute window price: sum of each micro-slot's price_override, fallback to default
        window_price = sum(
            float(s.price_override) if s.price_override is not None else default_per_micro
            for s in chunk
        )

        # Derive display statuses
        display_statuses = [_slot_display_status(s, now) for s in chunk]

        # If any expired, skip the window
        if any(ds == "EXPIRED" for ds in display_statuses):
            i += 3
            continue

        # If any disabled, window is DISABLED
        if any(ds == "DISABLED" for ds in display_statuses):
            windows.append(
                SlotWindowOut(
                    start=chunk[0].start_time,
                    end=window_end,
                    status="DISABLED",
                    free_micro_slots=0,
                    price=round(window_price, 2),
                )
            )
            i += 3
            continue

        free = [s for s in chunk if s.status == "AVAILABLE"]

        # Check if any micro-slot in this window was recently released
        chunk_recently_released = any(_is_recently_released(s, now) for s in chunk)

        # Check if any micro-slot in this window is an emergency slot
        chunk_is_emergency = any(getattr(s, "is_emergency_slot", False) for s in chunk)

        if len(free) == 3:
            windows.append(
                SlotWindowOut(
                    start=chunk[0].start_time,
                    end=window_end,
                    status="AVAILABLE",
                    free_micro_slots=3,
                    recently_released=chunk_recently_released,
                    is_emergency_slot=chunk_is_emergency,
                    price=round(window_price, 2),
                )
            )
        elif len(free) == 0:
            windows.append(
                SlotWindowOut(
                    start=chunk[0].start_time,
                    end=window_end,
                    status="BOOKED",
                    free_micro_slots=0,
                    is_emergency_slot=chunk_is_emergency,
                    price=round(window_price, 2),
                )
            )
        else:
            first_free = min(f.start_time for f in free)
            windows.append(
                SlotWindowOut(
                    start=chunk[0].start_time,
                    end=window_end,
                    status="PARTIAL",
                    available_from=first_free,
                    free_micro_slots=len(free),
                    recently_released=chunk_recently_released,
                    is_emergency_slot=chunk_is_emergency,
                    price=round(window_price, 2),
                )
            )

        i += 3

    return windows


# ── User-facing micro-slots by charger ────────────────────────────

@router.get("/by-charger", response_model=list[SlotOut])
def get_micro_slots_by_charger(charger_id: str, date: str, db: Session = Depends(get_db)):
    """List 10-min micro-slots for a charger on a given day, with display logic."""
    try:
        day = datetime.strptime(date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    start_dt = datetime.combine(day, time.min)
    end_dt = datetime.combine(day, time.max)
    now = _utcnow()

    slots = (
        db.query(Slot)
        .filter(
            Slot.charger_id == charger_id,
            Slot.start_time >= start_dt,
            Slot.start_time <= end_dt,
        )
        .order_by(Slot.start_time)
        .all()
    )

    result = []
    for s in slots:
        display = _slot_display_status(s, now)
        result.append(
            SlotOut(
                id=s.id,
                charger_id=s.charger_id,
                start_time=s.start_time,
                end_time=s.end_time,
                status=display,
                price_override=s.price_override,
                recently_released=_is_recently_released(s, now),
                is_emergency_slot=getattr(s, "is_emergency_slot", False),
            )
        )

    return result


# ── Available slot count ──────────────────────────────────────────

@router.get("/count")
def get_available_slots_count(station_id: str, db: Session = Depends(get_db)):
    chargers = db.query(Charger.id).filter(Charger.station_id == station_id).all()
    charger_ids = [c[0] for c in chargers]
    if not charger_ids:
        return {"available_slots": 0}

    now = _utcnow()
    # Only count today's micro-slots (not future days)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    count = (
        db.query(Slot)
        .filter(
            Slot.charger_id.in_(charger_ids),
            Slot.status == "AVAILABLE",
            Slot.start_time >= today_start,
            Slot.end_time <= today_end,
            Slot.end_time >= now,
        )
        .count()
    )
    return {"available_slots": count}


# ── Admin: grouped bookings (reads from Booking table) ────────────

@router.get("/admin/bookings")
def get_admin_bookings(
    station_id: str | None = None,
    date: str | None = None,
    db: Session = Depends(get_db),
):
    """Admin view: bookings grouped by booking_status.

    Reads from Booking table, NOT from Slot.status alone.
    """
    return get_admin_bookings_grouped(db, station_id=station_id, date=date)


# ── Admin: raw slots view ────────────────────────────────────────

@router.get("/admin/slots")
def get_admin_slots(db: Session = Depends(get_db)):
    results = (
        db.query(Slot, Booking, Car, User, Charger, Station)
        .join(Charger, Slot.charger_id == Charger.id)
        .join(Station, Charger.station_id == Station.id)
        .outerjoin(BookingSlot, BookingSlot.slot_id == Slot.id)
        .outerjoin(Booking, Booking.id == BookingSlot.booking_id)
        .outerjoin(Car, Car.id == Booking.car_id)
        .outerjoin(User, User.id == Booking.user_id)
        .order_by(Slot.start_time)
        .all()
    )

    now = _utcnow()
    response = []

    for slot, booking, car, user, charger, station in results:
        display = _slot_display_status(slot, now, booking.booking_status if booking else None)

        response.append(
            {
                "slot_id": slot.id,
                "station_id": station.id,
                "station_name": station.name,
                "charger_id": charger.id,
                "charger_name": getattr(charger, "name", None),
                "charger_type": getattr(charger, "charger_type", None),
                "start_time": slot.start_time,
                "end_time": slot.end_time,
                "status": display,
                "released_at": slot.released_at,
                "recently_released": _is_recently_released(slot, now),
                "is_emergency_slot": getattr(slot, "is_emergency_slot", False),
                "booking": None
                if not booking
                else {
                    "booking_id": booking.id,
                    "status": booking.booking_status,
                    "ticket_id": getattr(booking, "ticket_id", None),
                    "amount": getattr(booking, "amount", None),
                    "start_time": getattr(booking, "start_time", None),
                    "end_time": getattr(booking, "end_time", None),
                    "user": None
                    if not user
                    else {
                        "id": user.id,
                        "name": user.name,
                        "email": getattr(user, "email", None),
                    },
                    "car": None
                    if not car
                    else {
                        "brand": car.brand,
                        "model": car.model,
                        "car_number": car.car_number,
                    },
                },
            }
        )

    return response


# ── Admin: patch slot ─────────────────────────────────────────────

@router.patch("/{slot_id}")
def patch_slot(slot_id: str, payload: SlotPatchRequest, db: Session = Depends(get_db)):
    """Admin: update micro-slot's status and/or price override.
    Only AVAILABLE / DISABLED transitions are meaningful for admin.
    """
    slot = db.query(Slot).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if payload.status is not None:
        slot.status = payload.status

    if payload.price_override is not None:
        slot.price_override = payload.price_override

    if payload.is_emergency_slot is not None:
        slot.is_emergency_slot = payload.is_emergency_slot

    db.commit()
    return {"ok": True}


# ── Maintenance: de-duplicate slots ───────────────────────────────

@router.post("/dedupe")
def dedupe_slots(charger_id: str, date: str, db: Session = Depends(get_db)):
    try:
        day = datetime.strptime(date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    start_dt = datetime.combine(day, time.min)
    end_dt = datetime.combine(day, time.max)

    slots = (
        db.query(Slot)
        .filter(
            Slot.charger_id == charger_id,
            Slot.start_time >= start_dt,
            Slot.start_time <= end_dt,
        )
        .order_by(Slot.start_time, Slot.end_time, Slot.id)
        .all()
    )

    seen: set[tuple[datetime, datetime]] = set()
    deleted = 0
    for s in slots:
        key = (s.start_time, s.end_time)
        if key in seen:
            db.delete(s)
            deleted += 1
        else:
            seen.add(key)

    if deleted:
        db.commit()

    return {"ok": True, "deleted": deleted}

