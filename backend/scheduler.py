from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database.database import SessionLocal
from services.booking_lifecycle import run_booking_lifecycle_tick


def _booking_lifecycle_job() -> None:
    """APScheduler job entrypoint.

    Runs in the event loop scheduler thread. Uses its own DB session and closes it
    each run to avoid leaking connections.
    """
    db = SessionLocal()
    try:
        run_booking_lifecycle_tick(db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[WARN] booking lifecycle job failed: {e}")
    finally:
        db.close()


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()

    scheduler.add_job(
        _booking_lifecycle_job,
        trigger=IntervalTrigger(seconds=60),
        id="booking_lifecycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    return scheduler
