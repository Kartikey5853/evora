from __future__ import annotations

"""Deterministic lifecycle scheduler — runs every 60 seconds.

State transitions handled:

1. UPCOMING → GRACE
   When now >= first_slot.start_time
   booking_status = GRACE, first_slot.status = GRACE

2. GRACE → NO_SHOW
   When now >= first_slot.start_time + 10 minutes
   Release ONLY the first slot:
     first_slot.status = AVAILABLE
     first_slot.released_at = now
     delete BookingSlot row for first_slot
   booking_status = NO_SHOW

3. ACTIVE → COMPLETED
   When now >= booking.end_time
   booking_status = COMPLETED
   all associated slots → AVAILABLE
"""

from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database.database import SessionLocal
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


def _get_booking_slots(db, booking_id: str) -> list[Slot]:
    return (
        db.query(Slot)
        .join(BookingSlot, BookingSlot.slot_id == Slot.id)
        .filter(BookingSlot.booking_id == booking_id)
        .order_by(Slot.start_time.asc())
        .all()
    )


def run_lifecycle_tick(db) -> dict:
    """Single tick of the lifecycle engine. Returns counts for observability."""

    now = _utcnow()
    counts = {"to_grace": 0, "to_no_show": 0, "to_completed": 0}

    # ── UPCOMING / GRACE bookings ──────────────────────────────────
    pending = (
        db.query(Booking)
        .filter(Booking.booking_status.in_([BOOKING_UPCOMING, BOOKING_GRACE]))
        .all()
    )

    for b in pending:
        slots = _get_booking_slots(db, b.id)
        if not slots:
            continue

        first = slots[0]

        # 1) UPCOMING → GRACE when now >= first_slot.start_time
        if b.booking_status == BOOKING_UPCOMING and now >= first.start_time:
            b.booking_status = BOOKING_GRACE
            first.status = SLOT_GRACE
            counts["to_grace"] += 1

        # 2) GRACE → NO_SHOW when now >= first_slot.start_time + 10 min
        if b.booking_status == BOOKING_GRACE:
            grace_deadline = first.start_time + timedelta(minutes=GRACE_MINUTES)
            if now >= grace_deadline:
                # Release ONLY the first slot
                first.status = SLOT_AVAILABLE
                first.released_at = now

                db.query(BookingSlot).filter(
                    BookingSlot.booking_id == b.id,
                    BookingSlot.slot_id == first.id,
                ).delete(synchronize_session=False)

                b.booking_status = BOOKING_NO_SHOW
                counts["to_no_show"] += 1

    # ── ACTIVE → COMPLETED ─────────────────────────────────────────
    active = (
        db.query(Booking)
        .filter(Booking.booking_status == BOOKING_ACTIVE)
        .all()
    )

    for b in active:
        if b.end_time and now >= b.end_time:
            b.booking_status = BOOKING_COMPLETED

            # Release all associated slots
            b_slots = _get_booking_slots(db, b.id)
            for s in b_slots:
                s.status = SLOT_AVAILABLE

            counts["to_completed"] += 1

    return counts


def _tick() -> None:
    """APScheduler job entry point. Own DB session per run."""
    db = SessionLocal()
    try:
        run_lifecycle_tick(db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[WARN] lifecycle tick failed: {e}")
    finally:
        db.close()


def start() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _tick,
        trigger=IntervalTrigger(seconds=60),
        id="deterministic_booking_lifecycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    return scheduler
