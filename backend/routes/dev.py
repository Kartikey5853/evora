from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from dependencies import get_db
from models.booking import Booking
from models.slot import Slot
from models.booking_slot import BookingSlot
from models.car import Car
from models.charger import Charger
from models.user import User
from models.host import Host
from models.station import Station
from models.wallet_transaction import WalletTransaction

from services.booking_service import (
    scan_booking as scan_booking_service,
    create_booking as create_booking_service,
    complete_booking as complete_booking_service,
)

router = APIRouter(prefix="/dev", tags=["Dev"])

# In-memory bypass flag (resets on restart — good enough for dev/hackathon)
_bypass_enabled = False


@router.get("/overrides")
def overrides():
    return {
        "scheduler_running": True,
        "bypass_enabled": _bypass_enabled,
        "current_time": datetime.utcnow(),
    }


@router.post("/toggle-bypass")
def toggle_bypass():
    """Toggle global bypass mode. When on, admin ticket scan skips time-window checks."""
    global _bypass_enabled
    _bypass_enabled = not _bypass_enabled
    return {"bypass_enabled": _bypass_enabled}


@router.post("/admin-scan")
def admin_scan(payload: dict, db: Session = Depends(get_db)):
    """Admin ticket scan — no user auth required.

    Accepts: { ticket_id: "TICKET-..." } or { booking_id: "uuid" }
    Uses global bypass flag to decide bypass_mode.
    """
    booking_id = payload.get("booking_id")
    ticket_id = payload.get("ticket_id")

    if not booking_id and not ticket_id:
        raise HTTPException(status_code=400, detail="booking_id or ticket_id required")

    booking = None
    if booking_id:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking and ticket_id:
        booking = db.query(Booking).filter(Booking.ticket_id == ticket_id).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Look up car + user for response
    car = db.query(Car).filter(Car.id == booking.car_id).first() if booking.car_id else None
    user = db.query(User).filter(User.id == booking.user_id).first() if booking.user_id else None

    try:
        b = scan_booking_service(db, booking.id, bypass_mode=_bypass_enabled)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return {
        "ok": True,
        "booking_id": b.id,
        "ticket_id": getattr(b, "ticket_id", None),
        "booking_status": b.booking_status,
        "start_time": b.start_time,
        "end_time": b.end_time,
        "user": {"id": user.id, "name": user.name, "email": user.email} if user else None,
        "car": {"brand": car.brand, "model": car.model, "car_number": car.car_number} if car else None,
    }


@router.post("/grace-test/{booking_id}")
def grace_test(booking_id: str, db: Session = Depends(get_db)):
    """Force a booking into GRACE state for testing.

    Sets booking_status -> GRACE and first slot -> GRACE.
    If ticket is not entered within 10 min the lifecycle scheduler will
    release the first slot (20 min of the 30-min window) back to the pool.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booking_status not in ("UPCOMING",):
        raise HTTPException(
            status_code=400,
            detail=f"Can only start grace test from UPCOMING, current={booking.booking_status}",
        )

    # Move to GRACE
    booking.booking_status = "GRACE"

    # Also set first slot to GRACE
    slots = (
        db.query(Slot)
        .join(BookingSlot, BookingSlot.slot_id == Slot.id)
        .filter(BookingSlot.booking_id == booking.id)
        .order_by(Slot.start_time.asc())
        .all()
    )
    if slots and slots[0].status == "BOOKED":
        slots[0].status = "GRACE"

    db.commit()
    return {
        "ok": True,
        "booking_id": booking.id,
        "booking_status": booking.booking_status,
        "message": "Booking moved to GRACE. If no scan within 10 min, first slot released.",
    }


@router.post("/grace-arrive/{booking_id}")
def grace_arrive(booking_id: str, db: Session = Depends(get_db)):
    """Dev: Car arrived during grace — move GRACE → ACTIVE.

    Also restores first slot from GRACE → BOOKED so it stays claimed.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booking_status != "GRACE":
        raise HTTPException(status_code=400, detail=f"Booking is not in GRACE (current={booking.booking_status})")

    # Restore first slot from GRACE → BOOKED
    slots = (
        db.query(Slot)
        .join(BookingSlot, BookingSlot.slot_id == Slot.id)
        .filter(BookingSlot.booking_id == booking.id)
        .order_by(Slot.start_time.asc())
        .all()
    )
    if slots and slots[0].status == "GRACE":
        slots[0].status = "BOOKED"

    booking.booking_status = "ACTIVE"
    db.commit()
    return {"ok": True, "booking_id": booking_id, "booking_status": "ACTIVE"}


@router.post("/grace-noshow/{booking_id}")
def grace_noshow(booking_id: str, db: Session = Depends(get_db)):
    """Dev: Car didn't arrive — force GRACE → NO_SHOW.

    Releases first slot back to AVAILABLE, deletes its BookingSlot link,
    sets released_at so it shows as recently_released on user side.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booking_status != "GRACE":
        raise HTTPException(status_code=400, detail=f"Booking is not in GRACE (current={booking.booking_status})")

    now = datetime.utcnow()
    slots = (
        db.query(Slot)
        .join(BookingSlot, BookingSlot.slot_id == Slot.id)
        .filter(BookingSlot.booking_id == booking.id)
        .order_by(Slot.start_time.asc())
        .all()
    )

    if slots:
        first = slots[0]
        first.status = "AVAILABLE"
        first.released_at = now

        db.query(BookingSlot).filter(
            BookingSlot.booking_id == booking.id,
            BookingSlot.slot_id == first.id,
        ).delete(synchronize_session=False)

    booking.booking_status = "NO_SHOW"
    db.commit()
    return {"ok": True, "booking_id": booking_id, "booking_status": "NO_SHOW"}


@router.post("/force-complete/{booking_id}")
def force_complete(booking_id: str, db: Session = Depends(get_db)):
    """Dev: Force ACTIVE → COMPLETED immediately (skip timer).    Releases all slots back to AVAILABLE.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booking_status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Booking is not ACTIVE (current={booking.booking_status})")

    # Host wallet credit happens at booking creation (v2 / walk-in).
    # No duplicate credit here.

    complete_booking_service(db, booking)
    db.commit()
    return {"ok": True, "booking_id": booking_id, "booking_status": "COMPLETED"}


@router.post("/walk-in")
def walk_in_by_car_number(payload: dict, db: Session = Depends(get_db)):
    """Admin walk-in: book a slot on the spot by car number.

    Accepts: { car_number, charger_id, duration_minutes? }
    Creates an ACTIVE booking immediately.
    Works for ANY car number — if the car isn't registered, we still book
    with car_id=None and user_id=None (anonymous walk-in).
    """
    car_number = (payload.get("car_number") or "").strip().upper()
    charger_id = payload.get("charger_id")
    duration_minutes = int(payload.get("duration_minutes", 30))

    if not car_number:
        raise HTTPException(status_code=400, detail="car_number required")
    if not charger_id:
        raise HTTPException(status_code=400, detail="charger_id required")
    if duration_minutes not in (30, 60, 90, 120):
        raise HTTPException(status_code=400, detail="duration_minutes must be 30, 60, 90, or 120")

    # Try to find registered car — if not found, that's fine (anonymous walk-in)
    car = db.query(Car).filter(Car.car_number == car_number).first()
    user = None
    if car:
        user = db.query(User).filter(User.id == car.user_id).first()

    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    # Find available micro-slots starting from now
    now = datetime.utcnow()
    needed = duration_minutes // 10

    available_slots = (
        db.query(Slot)
        .filter(
            Slot.charger_id == charger_id,
            Slot.status == "AVAILABLE",
            Slot.start_time >= now - timedelta(minutes=10),
            Slot.end_time > now,
        )
        .order_by(Slot.start_time.asc())
        .all()
    )

    # Pick first `needed` contiguous slots
    chosen = []
    for s in available_slots:
        if not chosen:
            chosen.append(s)
        elif s.start_time == chosen[-1].end_time:
            chosen.append(s)
        else:
            chosen = [s]
        if len(chosen) == needed:
            break

    if len(chosen) < needed:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough contiguous available slots. Need {needed}, found {len(chosen)}",
        )

    price_30 = float(getattr(charger, "default_price_30min", None) or 0.0)
    total = price_30 * (duration_minutes / 30) if price_30 else 0.0

    try:
        booking = create_booking_service(
            db,
            user_id=car.user_id if car else None,
            station_id=charger.station_id,
            charger_id=charger_id,
            car_id=car.id if car else None,
            slot_ids=[s.id for s in chosen],
            start_time=chosen[0].start_time,
            end_time=chosen[-1].end_time,
            total_amount=total,
            priority="WALK_IN",
            make_active=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── Wallet debit (if registered user) + host credit (80/20 split) ──
    if total > 0:
        if user:
            balance = float(getattr(user, "wallet_balance", 0) or 0)
            if balance >= total:
                user.wallet_balance = balance - total
                db.add(WalletTransaction(
                    user_id=user.id,
                    type="DEBIT",
                    amount=total,
                    description=f"Walk-in booking – {duration_minutes}min",
                ))
        # Credit host
        station_obj = db.query(Station).filter(Station.id == charger.station_id).first()
        if station_obj and station_obj.host_id:
            host = db.query(Host).filter(Host.id == station_obj.host_id).first()
            if host:
                host_share = round(total * 0.80, 2)
                host.wallet_balance = float(getattr(host, "wallet_balance", 0) or 0) + host_share

    db.commit()

    return {
        "ok": True,
        "booking_id": booking.id,
        "ticket_id": getattr(booking, "ticket_id", None),
        "booking_status": booking.booking_status,
        "start_time": booking.start_time,
        "end_time": booking.end_time,
        "car_number": car_number,
        "user": {"id": user.id, "name": user.name, "email": user.email} if user else None,
        "car": {"brand": car.brand, "model": car.model, "car_number": car.car_number} if car else None,
        "total_amount": total,
    }


@router.post("/bypass-arrival/{booking_id}")
def bypass_arrival(booking_id: str, db: Session = Depends(get_db)):
    """Dev shortcut: force booking to ACTIVE (bypass_mode equivalent)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booking_status not in ("UPCOMING", "GRACE"):
        raise HTTPException(status_code=400, detail=f"Cannot activate from {booking.booking_status}")

    booking.booking_status = "ACTIVE"
    db.commit()
    return {"ok": True, "booking_id": booking_id, "booking_status": "ACTIVE"}


@router.get("/repair-slots")
def repair_slots(db: Session = Depends(get_db)):
    """Align slot status with BookingSlot linkage. Respects DISABLED and GRACE."""
    linked_slot_ids = {r[0] for r in db.query(BookingSlot.slot_id).distinct().all()}

    repaired = 0
    total = 0
    for s in db.query(Slot).all():
        total += 1
        if s.status == "DISABLED":
            continue

        has_link = s.id in linked_slot_ids
        if not has_link and s.status in ("BOOKED", "GRACE"):
            s.status = "AVAILABLE"
            repaired += 1

    db.commit()
    return {"total_slots": total, "repaired_slots": repaired}


@router.post("/emergency-override")
def emergency_override(payload: dict, db: Session = Depends(get_db)):
    """Override a normal booking on an emergency slot with an emergency vehicle booking.

    Accepts: { car_id, charger_id, slot_start, slot_end }
    - The target slots must be emergency-flagged (is_emergency_slot=True).
    - If slots are BOOKED by a normal (non-emergency) booking, that booking is
      bumped to OVERRIDDEN, its slots are released, and a new emergency booking
      is created in ACTIVE state.
    - Normal (non-emergency) slots CANNOT be overridden.
    """
    car_id = payload.get("car_id")
    charger_id = payload.get("charger_id")
    slot_start = payload.get("slot_start")
    slot_end = payload.get("slot_end")

    if not car_id or not charger_id or not slot_start or not slot_end:
        raise HTTPException(status_code=400, detail="car_id, charger_id, slot_start, slot_end required")

    # Validate the car is an approved emergency vehicle
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if not car.is_emergency or car.emergency_status != "APPROVED":
        raise HTTPException(status_code=400, detail="Car is not an approved emergency vehicle")

    user = db.query(User).filter(User.id == car.user_id).first() if car.user_id else None

    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    from datetime import datetime as dt_cls
    try:
        start_dt = dt_cls.fromisoformat(slot_start)
        end_dt = dt_cls.fromisoformat(slot_end)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime format for slot_start/slot_end")

    # Find all micro-slots in the range
    target_slots = (
        db.query(Slot)
        .filter(
            Slot.charger_id == charger_id,
            Slot.start_time >= start_dt,
            Slot.end_time <= end_dt,
        )
        .order_by(Slot.start_time.asc())
        .all()
    )

    if not target_slots:
        raise HTTPException(status_code=404, detail="No slots found in the specified range")

    # Verify ALL target slots are emergency-flagged
    non_emergency_slots = [s for s in target_slots if not getattr(s, "is_emergency_slot", False)]
    if non_emergency_slots:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot override: {len(non_emergency_slots)} slot(s) are not emergency-flagged. Only emergency slots can be overridden.",
        )

    # Find and bump any existing normal bookings on these slots
    bumped_bookings = []
    for slot in target_slots:
        if slot.status in ("BOOKED", "GRACE"):
            # Find the booking linked to this slot
            bs = db.query(BookingSlot).filter(BookingSlot.slot_id == slot.id).first()
            if bs:
                booking = db.query(Booking).filter(Booking.id == bs.booking_id).first()
                if booking and booking.id not in [bb["booking_id"] for bb in bumped_bookings]:
                    # Only bump non-emergency bookings
                    booked_car = db.query(Car).filter(Car.id == booking.car_id).first() if booking.car_id else None
                    is_emergency_booking = booked_car and booked_car.is_emergency and booked_car.emergency_status == "APPROVED"

                    if not is_emergency_booking:
                        # Release ALL slots of this booking
                        booking_slots = (
                            db.query(Slot)
                            .join(BookingSlot, BookingSlot.slot_id == Slot.id)
                            .filter(BookingSlot.booking_id == booking.id)
                            .all()
                        )
                        for bs_slot in booking_slots:
                            bs_slot.status = "AVAILABLE"
                            bs_slot.released_at = datetime.utcnow()

                        # Delete BookingSlot links
                        db.query(BookingSlot).filter(BookingSlot.booking_id == booking.id).delete(synchronize_session=False)

                        # Mark booking as overridden
                        booking.booking_status = "OVERRIDDEN"
                        booking.was_overridden = True

                        bumped_bookings.append({
                            "booking_id": booking.id,
                            "ticket_id": getattr(booking, "ticket_id", None),
                            "user_id": booking.user_id,
                        })

    # Now create the emergency booking
    try:
        emergency_booking = create_booking_service(
            db,
            user_id=car.user_id if car else None,
            station_id=charger.station_id,
            charger_id=charger_id,
            car_id=car.id,
            slot_ids=[s.id for s in target_slots],
            start_time=target_slots[0].start_time,
            end_time=target_slots[-1].end_time,
            total_amount=0.0,  # Emergency vehicles — no charge
            priority="EMERGENCY",
            make_active=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Link bumped bookings to the emergency booking
    for bb in bumped_bookings:
        bumped = db.query(Booking).filter(Booking.id == bb["booking_id"]).first()
        if bumped:
            bumped.overridden_by_booking_id = emergency_booking.id

    db.commit()

    return {
        "ok": True,
        "emergency_booking_id": emergency_booking.id,
        "ticket_id": getattr(emergency_booking, "ticket_id", None),
        "booking_status": emergency_booking.booking_status,
        "start_time": emergency_booking.start_time,
        "end_time": emergency_booking.end_time,
        "car": {"brand": car.brand, "model": car.model, "car_number": car.car_number},
        "user": {"id": user.id, "name": user.name, "email": user.email} if user else None,
        "bumped_bookings": bumped_bookings,
    }

