from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
from typing import List
from models.booking import Booking
from dependencies import get_db, get_current_user
from schema.booking import BookingOut
from models.slot import Slot
from schema.booking_engine import BookingCreateV2, BookingCreateV2Out, BookingScanRequest
from models.booking_slot import BookingSlot
from models.charger import Charger
from models.user import User
from models.host import Host
from models.station import Station
from models.wallet_transaction import WalletTransaction

from services.booking_service import (
    cancel_booking as cancel_booking_service,
    create_booking as create_booking_service,
    scan_booking as scan_booking_service,
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ------------------------------------------------------------------
# Legacy endpoints removed.
# ------------------------------------------------------------------
@router.post("/")
def create_booking(*args, **kwargs):
    raise HTTPException(status_code=410, detail="Legacy endpoint removed; use POST /bookings/v2")


@router.get("/")
def get_user_bookings(*args, **kwargs):
    raise HTTPException(status_code=410, detail="Legacy endpoint removed; use GET /bookings/my")


@router.get("/bookings", response_model=List[BookingOut])
def get_bookings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return (
        db.query(Booking)
        .filter(Booking.user_id == user_id)
        .order_by(Booking.created_at.desc())
        .all()
    )


@router.post("/v2", response_model=BookingCreateV2Out)
def create_booking_v2(
    payload: BookingCreateV2,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        day = datetime.strptime(payload.date, "%Y-%m-%d").date()
        hh, mm = payload.start_time.split(":")
        start_dt = datetime.combine(day, datetime.min.time()).replace(hour=int(hh), minute=int(mm))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date/start_time. Use date=YYYY-MM-DD and start_time=HH:MM")

    if payload.duration_minutes % 30 != 0 or payload.duration_minutes <= 0 or payload.duration_minutes > 120:
        raise HTTPException(status_code=400, detail="duration_minutes must be 30..120 in steps of 30")

    end_dt = start_dt + timedelta(minutes=payload.duration_minutes)

    charger = db.query(Charger).filter(Charger.id == payload.charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    # Fetch contiguous 10-minute micro-slots within the window
    raw_slots: list[Slot] = (
        db.query(Slot)
        .filter(
            Slot.charger_id == payload.charger_id,
            Slot.start_time >= start_dt,
            Slot.end_time <= end_dt,
        )
        .order_by(Slot.start_time, Slot.end_time, Slot.id)
        .all()
    )

    # De-duplicate by (start_time, end_time) — keep AVAILABLE over others
    by_range: dict[tuple[datetime, datetime], Slot] = {}
    for s in raw_slots:
        key = (s.start_time, s.end_time)
        cur = by_range.get(key)
        if cur is None:
            by_range[key] = s
        elif s.status == "AVAILABLE" and cur.status != "AVAILABLE":
            by_range[key] = s

    slots = sorted(by_range.values(), key=lambda x: x.start_time)

    expected = int(payload.duration_minutes / 10)
    if len(slots) != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Selected window is not available (missing micro-slots). expected={expected}, found={len(slots)}",
        )

    # Require exact contiguity
    for i in range(0, len(slots) - 1):
        if slots[i].end_time != slots[i + 1].start_time:
            raise HTTPException(status_code=400, detail="Selected window is not contiguous")
    # Only AVAILABLE slots can be booked
    if any(s.status != "AVAILABLE" for s in slots):
        raise HTTPException(status_code=400, detail="Selected window is not fully available")

    # Create booking via service — sum actual slot prices
    price_30 = float(getattr(charger, "default_price_30min", None) or 0.0)
    default_per_micro = price_30 / 3.0
    total = sum(
        float(s.price_override) if s.price_override is not None else default_per_micro
        for s in slots
    )
    if total <= 0:
        raise HTTPException(status_code=400, detail="Charger pricing not configured (default_price_30min is 0)")

    # ── Wallet debit ──────────────────────────────────────────────
    user = db.query(User).filter(User.id == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    balance = float(getattr(user, "wallet_balance", 0) or 0)
    if balance < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient EV Points. Need {total:.2f}, have {balance:.2f}. Please add funds first.",
        )
    user.wallet_balance = balance - total

    # Record debit transaction
    db.add(WalletTransaction(
        user_id=current_user,
        type="DEBIT",
        amount=total,
        description=f"Booking payment – {payload.duration_minutes}min @ station",
    ))

    # ── Revenue split: 80% to host ────────────────────────────────
    station = db.query(Station).filter(Station.id == payload.station_id).first()
    if station:
        host = db.query(Host).filter(Host.id == station.host_id).first()
        if host:
            host_share = round(total * 0.80, 2)
            host.wallet_balance = float(getattr(host, "wallet_balance", 0) or 0) + host_share

    booking = create_booking_service(
        db,
        user_id=current_user,
        station_id=payload.station_id,
        charger_id=payload.charger_id,
        car_id=payload.car_id,
        slot_ids=[s.id for s in slots],
        start_time=start_dt,
        end_time=end_dt,
        total_amount=total,
        priority="NORMAL",
        make_active=False,
    )

    db.commit()

    return BookingCreateV2Out(
        booking_id=booking.id,
        ticket_id=booking.ticket_id,
        amount=total,
        host_share=round(total * 0.80, 2),
        platform_share=round(total * 0.20, 2),
        start_time=start_dt,
        end_time=end_dt,
    )


@router.get("/my")
def get_my_bookings_v2(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Transactions page — bookings aggregated from BookingSlot→Slot ranges."""

    rows = (
        db.query(Booking, Slot)
        .join(BookingSlot, BookingSlot.booking_id == Booking.id)
        .join(Slot, Slot.id == BookingSlot.slot_id)
        .filter(Booking.user_id == user_id)
        .order_by(Booking.created_at.desc(), Slot.start_time.asc())
        .all()
    )

    by_booking: dict[str, dict] = {}
    for b, s in rows:
        item = by_booking.get(b.id)
        if item is None:
            item = {
                "booking_id": b.id,
                "ticket_id": getattr(b, "ticket_id", None),
                "station_id": getattr(b, "station_id", None),
                "charger_id": getattr(b, "charger_id", None),
                "start_time": s.start_time,
                "end_time": s.end_time,
                "total_amount": float(getattr(b, "total_amount", None) or getattr(b, "amount", None) or 0.0),
                "booking_status": getattr(b, "booking_status", None),
                "created_at": getattr(b, "created_at", None),
                "was_overridden": getattr(b, "was_overridden", False),
            }
            by_booking[b.id] = item
        else:
            if s.start_time and item["start_time"] and s.start_time < item["start_time"]:
                item["start_time"] = s.start_time
            if s.end_time and item["end_time"] and s.end_time > item["end_time"]:
                item["end_time"] = s.end_time
    # Also include bookings with no remaining slots (CANCELLED, NO_SHOW, OVERRIDDEN)
    orphan_bookings = (
        db.query(Booking)
        .filter(
            Booking.user_id == user_id,
            Booking.booking_status.in_(["CANCELLED", "NO_SHOW", "COMPLETED", "OVERRIDDEN"]),
            ~Booking.id.in_(list(by_booking.keys())) if by_booking else True,
        )
        .order_by(Booking.created_at.desc())
        .all()
    )

    for b in orphan_bookings:
        if b.id not in by_booking:
            by_booking[b.id] = {
                "booking_id": b.id,
                "ticket_id": getattr(b, "ticket_id", None),
                "station_id": getattr(b, "station_id", None),
                "charger_id": getattr(b, "charger_id", None),
                "start_time": b.start_time,
                "end_time": b.end_time,
                "total_amount": float(getattr(b, "total_amount", None) or getattr(b, "amount", None) or 0.0),
                "booking_status": b.booking_status,
                "created_at": getattr(b, "created_at", None),
                "was_overridden": getattr(b, "was_overridden", False),
            }

    return list(by_booking.values())


@router.post("/{booking_id}/cancel")
def cancel_booking_endpoint(
    booking_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Cancel UPCOMING bookings before start_time."""

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    try:
        cancel_booking_service(db, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return {"ok": True, "booking_id": booking_id, "booking_status": "CANCELLED"}


@router.post("/{booking_id}/scan")
def scan_booking_endpoint(
    booking_id: str,
    payload: BookingScanRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """QR scan endpoint.

    bypass_mode=true  → immediately ACTIVE.
    bypass_mode=false → only within [start_time, end_time].
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    try:
        b = scan_booking_service(db, booking_id, bypass_mode=payload.bypass_mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return {"ok": True, "booking_id": b.id, "booking_status": b.booking_status}


@router.post("/walk-in")
def walk_in_booking(payload: dict, db: Session = Depends(get_db)):
    user_id = payload.get("user_id")
    charger_id = payload.get("charger_id")
    slot_ids = payload.get("slot_ids") or []

    if not user_id or not charger_id or not isinstance(slot_ids, list) or len(slot_ids) == 0:
        raise HTTPException(status_code=400, detail="user_id, charger_id, slot_ids[] required")

    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    try:
        booking = create_booking_service(
            db,
            user_id=user_id,
            station_id=charger.station_id,
            charger_id=charger_id,
            car_id=payload.get("car_id"),
            slot_ids=slot_ids,
            total_amount=float(payload.get("amount") or 0.0) or None,
            priority="NORMAL",
            make_active=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()

    return {
        "ok": True,
        "booking_id": booking.id,
        "ticket_id": getattr(booking, "ticket_id", None),
        "booking_status": booking.booking_status,
        "start_time": booking.start_time,
        "end_time": booking.end_time,
    }