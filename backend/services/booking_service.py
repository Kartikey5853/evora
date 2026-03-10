from __future__ import annotations

"""Booking service helpers — deterministic lifecycle.

State transitions determined entirely by:
  Slot.status, Booking.booking_status, Slot.start_time, Slot.end_time.

No additional booleans. No hidden flags. No OR joins.
"""

from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from models.booking import Booking
from models.slot import Slot
from models.booking_slot import BookingSlot

# ── Status constants ──────────────────────────────────────────────

BOOKING_UPCOMING = "UPCOMING"
BOOKING_GRACE = "GRACE"
BOOKING_ACTIVE = "ACTIVE"
BOOKING_COMPLETED = "COMPLETED"
BOOKING_NO_SHOW = "NO_SHOW"
BOOKING_CANCELLED = "CANCELLED"

SLOT_AVAILABLE = "AVAILABLE"
SLOT_BOOKED = "BOOKED"
SLOT_GRACE = "GRACE"
SLOT_DISABLED = "DISABLED"


def _utcnow() -> datetime:
    return datetime.utcnow()


def _get_booking_slots(db: Session, booking_id: str) -> list[Slot]:
    return (
        db.query(Slot)
        .join(BookingSlot, BookingSlot.slot_id == Slot.id)
        .filter(BookingSlot.booking_id == booking_id)
        .order_by(Slot.start_time.asc())
        .all()
    )


def _validate_contiguous(slots: list[Slot]) -> None:
    for i in range(len(slots) - 1):
        if slots[i].end_time != slots[i + 1].start_time:
            raise ValueError("Slots must be continuous")


def create_booking(
    db: Session,
    *,
    user_id: str | None,
    station_id: str,
    charger_id: str | None,
    car_id: str | None,
    slot_ids: list[str],
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    total_amount: float | None = None,
    priority: str = "NORMAL",
    make_active: bool = False,
) -> Booking:
    """Create a booking.

    Validates: every slot.status == AVAILABLE, slots are continuous.
    Sets: slot.status = BOOKED, booking_status = UPCOMING (or ACTIVE for walk-in).
    """
    if not slot_ids:
        raise ValueError("slot_ids required")

    slots = (
        db.query(Slot)
        .filter(Slot.id.in_(slot_ids))
        .order_by(Slot.start_time.asc())
        .all()
    )
    if len(slots) != len(slot_ids):
        raise ValueError("One or more slots not found")

    for s in slots:
        if s.status != SLOT_AVAILABLE:
            raise ValueError(f"Slot {s.id} is not AVAILABLE (status={s.status})")

    _validate_contiguous(slots)

    if start_time is None:
        start_time = slots[0].start_time
    if end_time is None:
        end_time = slots[-1].end_time

    booking = Booking(
        id=str(uuid.uuid4()),
        user_id=user_id,
        station_id=station_id,
        charger_id=charger_id,
        car_id=car_id,
        start_time=start_time,
        end_time=end_time,
        total_amount=total_amount,
        amount=total_amount,
        ticket_id="TICKET-" + uuid.uuid4().hex[:10].upper(),
        booking_status=BOOKING_ACTIVE if make_active else BOOKING_UPCOMING,
        priority=priority or "NORMAL",
    )

    db.add(booking)
    db.flush()

    for s in slots:
        s.status = SLOT_BOOKED
        db.add(BookingSlot(booking_id=booking.id, slot_id=s.id, price=float(s.price_override or 0.0)))

    return booking


def cancel_booking(db: Session, booking_id: str) -> Booking:
    """Cancel before booking.start_time.

    All slots → AVAILABLE, delete BookingSlot rows, booking_status → CANCELLED.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise ValueError("Booking not found")

    now = _utcnow()
    if booking.start_time and now >= booking.start_time:
        raise ValueError("Cannot cancel after booking start_time")

    if booking.booking_status not in (BOOKING_UPCOMING, BOOKING_GRACE):
        raise ValueError(f"Cannot cancel booking in status {booking.booking_status}")

    slots = _get_booking_slots(db, booking_id)
    for s in slots:
        s.status = SLOT_AVAILABLE

    db.query(BookingSlot).filter(BookingSlot.booking_id == booking_id).delete(synchronize_session=False)
    booking.booking_status = BOOKING_CANCELLED
    return booking


def scan_booking(db: Session, booking_id: str, bypass_mode: bool = False) -> Booking:
    """QR scan endpoint logic.

    bypass_mode == True  → immediately ACTIVE (no time check).
    bypass_mode == False → only if now within [start_time, end_time].
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise ValueError("Booking not found")

    if booking.booking_status == BOOKING_ACTIVE:
        return booking  # idempotent

    if booking.booking_status not in (BOOKING_UPCOMING, BOOKING_GRACE):
        raise ValueError(f"Cannot activate booking in status {booking.booking_status}")

    if bypass_mode:
        booking.booking_status = BOOKING_ACTIVE
        return booking

    now = _utcnow()
    if not (booking.start_time and booking.end_time):
        raise ValueError("Booking has no time range")
    if now < booking.start_time:
        raise ValueError("Cannot scan before booking start_time")
    if now > booking.end_time:
        raise ValueError("Cannot scan after booking end_time")

    booking.booking_status = BOOKING_ACTIVE
    return booking


def complete_booking(db: Session, booking: Booking) -> None:
    """ACTIVE → COMPLETED when now >= end_time. All slots → AVAILABLE."""
    booking.booking_status = BOOKING_COMPLETED
    slots = _get_booking_slots(db, booking.id)
    for s in slots:
        s.status = SLOT_AVAILABLE
