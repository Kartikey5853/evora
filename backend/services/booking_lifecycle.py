from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.booking import Booking
from models.slot import Slot
from models.booking_slot import BookingSlot

BOOKING_UPCOMING = "UPCOMING"
BOOKING_GRACE = "GRACE"
BOOKING_ACTIVE = "ACTIVE"
BOOKING_COMPLETED = "COMPLETED"
BOOKING_NO_SHOW = "NO_SHOW"

SLOT_AVAILABLE = "AVAILABLE"
SLOT_BOOKED = "BOOKED"
SLOT_GRACE = "GRACE"

GRACE_MINUTES = 10


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


def run_booking_lifecycle_tick(db: Session) -> dict:
    """Time-based lifecycle engine.

    Simplified GRACE release:
      - UPCOMING -> GRACE when now >= booking.start_time
      - GRACE -> NO_SHOW when now >= first_slot.start_time + 10 min
        releases ONLY the first slot, deletes its BookingSlot mapping,
        sets first_slot.released_at=now

    ACTIVE -> COMPLETED releases all slots to AVAILABLE.
    """

    now = _utcnow()
    counts = {"processed": 0, "to_grace": 0, "to_no_show": 0, "to_completed": 0}

    pending: list[Booking] = (
        db.query(Booking)
        .filter(Booking.booking_status.in_([BOOKING_UPCOMING, BOOKING_GRACE]))
        .all()
    )

    for b in pending:
        slots = _get_booking_slots(db, b.id)
        if not slots:
            continue
        first = slots[0]
        counts["processed"] += 1

        # UPCOMING -> GRACE based on booking.start_time
        if b.start_time and now >= b.start_time and b.booking_status == BOOKING_UPCOMING:
            b.booking_status = BOOKING_GRACE
            counts["to_grace"] += 1
            if first.status == SLOT_BOOKED:
                first.status = SLOT_GRACE

        # GRACE -> NO_SHOW: release ONLY the first slot
        if b.booking_status == BOOKING_GRACE:
            grace_deadline = first.start_time + timedelta(minutes=GRACE_MINUTES)
            if now >= grace_deadline:
                first.status = SLOT_AVAILABLE
                first.released_at = now

                db.query(BookingSlot).filter(
                    BookingSlot.booking_id == b.id,
                    BookingSlot.slot_id == first.id,
                ).delete(synchronize_session=False)

                b.booking_status = BOOKING_NO_SHOW
                counts["to_no_show"] += 1

    active: list[Booking] = db.query(Booking).filter(Booking.booking_status == BOOKING_ACTIVE).all()
    for b in active:
        if not b.end_time:
            continue
        counts["processed"] += 1
        if now >= b.end_time:
            b.booking_status = BOOKING_COMPLETED

            b_slots = _get_booking_slots(db, b.id)
            for s in b_slots:
                s.status = SLOT_AVAILABLE

            counts["to_completed"] += 1

    return counts
