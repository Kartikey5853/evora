from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from dependencies import get_db
from models.slot import Slot

router = APIRouter(prefix="/debug", tags=["Debug"])


@router.get("/slot-status-summary")
def slot_status_summary(db: Session = Depends(get_db)):
    now = datetime.utcnow()

    total = db.query(Slot).count()
    available = db.query(Slot).filter(Slot.status == "AVAILABLE").count()
    booked = db.query(Slot).filter(Slot.status == "BOOKED").count()
    grace = db.query(Slot).filter(Slot.status == "GRACE").count()
    disabled = db.query(Slot).filter(Slot.status == "DISABLED").count()
    expired = db.query(Slot).filter(Slot.end_time < now).count()

    return {
        "total_slots": total,
        "available_slots": available,
        "booked_slots": booked,
        "grace_slots": grace,
        "disabled_slots": disabled,
        "expired_slots_derived": expired,
    }
