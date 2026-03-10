from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database.database import SessionLocal
from services.booking_lifecycle import run_booking_lifecycle_tick


def _tick() -> None:
    db = SessionLocal()
    try:
        run_booking_lifecycle_tick(db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[WARN] lifecycle tick failed: {e}")
    finally:
        db.close()


def start_lifecycle_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()

    scheduler.add_job(
        _tick,
        trigger=IntervalTrigger(seconds=60),
        id="booking_slot_lifecycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    return scheduler
