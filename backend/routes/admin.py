from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from datetime import datetime, timedelta
from collections import defaultdict

from dependencies import get_db, get_current_admin
from models.host import Host
from models.slot import Slot
from models.booking_slot import BookingSlot
from models.booking import Booking
from models.station import Station
from services.admin_query_service import get_admin_bookings_grouped

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/me")
def admin_me(db: Session = Depends(get_db), admin_id: str = Depends(get_current_admin)):
    admin = db.query(Host).filter(Host.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    return {
        "id": admin.id,
        "name": admin.name,
        "email": admin.email,
        "profile_pic_url": getattr(admin, "profile_pic_url", None),
    }


@router.patch("/me")
def admin_update_me(data: dict, db: Session = Depends(get_db), admin_id: str = Depends(get_current_admin)):
    admin = db.query(Host).filter(Host.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    if "name" in data and isinstance(data.get("name"), str):
        admin.name = data["name"].strip() or admin.name
    if "profile_pic_url" in data:
        admin.profile_pic_url = data.get("profile_pic_url") or None

    db.commit()
    return {"success": True}


@router.post("/me/profile-picture")
async def admin_upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    admin = db.query(Host).filter(Host.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are supported")

    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large (max 2MB)")

    import base64

    encoded = base64.b64encode(raw).decode("utf-8")
    admin.profile_pic_url = f"data:{file.content_type};base64,{encoded}"
    db.commit()

    return {"success": True, "profile_pic_url": admin.profile_pic_url}


@router.delete("/me/profile-picture")
def admin_remove_profile_picture(db: Session = Depends(get_db), admin_id: str = Depends(get_current_admin)):
    admin = db.query(Host).filter(Host.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    admin.profile_pic_url = None
    db.commit()
    return {"success": True}


@router.get("/bookings")
def admin_bookings_grouped(
    station_id: str | None = None,
    date: str | None = None,
    db: Session = Depends(get_db),
):
    """Admin view: bookings grouped into 6 sections by booking_status.

    ACTIVE | UPCOMING | GRACE | COMPLETED | CANCELLED | NO_SHOW
    Reads from Booking table, not from Slot.status alone.
    """
    return get_admin_bookings_grouped(db, station_id=station_id, date=date)


@router.get("/debug/slot-integrity")
def debug_slot_integrity(db: Session = Depends(get_db)):
    total = db.query(Slot).count()
    booked = db.query(Slot).filter(Slot.status == "BOOKED").count()
    available = db.query(Slot).filter(Slot.status == "AVAILABLE").count()
    grace = db.query(Slot).filter(Slot.status == "GRACE").count()
    disabled = db.query(Slot).filter(Slot.status == "DISABLED").count()

    linked_slot_ids = {r[0] for r in db.query(BookingSlot.slot_id).distinct().all()}

    orphan_booked = (
        db.query(Slot)
        .filter(Slot.status == "BOOKED")
        .filter(~Slot.id.in_(linked_slot_ids) if linked_slot_ids else True)
        .count()
    )

    return {
        "total_slots": total,
        "booked_slots": booked,
        "available_slots": available,
        "grace_slots": grace,
        "disabled_slots": disabled,
        "orphan_booked_slots": orphan_booked,
    }


@router.post("/repair/slot-consistency")
def repair_slot_consistency(db: Session = Depends(get_db)):
    """Sweep slots and align status with BookingSlot existence.

    - If BookingSlot exists for slot → keep current status (BOOKED/GRACE).
    - If no BookingSlot and status is BOOKED/GRACE → set AVAILABLE.
    - DISABLED slots are never touched.
    """
    linked_slot_ids = {r[0] for r in db.query(BookingSlot.slot_id).distinct().all()}

    touched = 0
    for s in db.query(Slot).all():
        if s.status == "DISABLED":
            continue

        has_link = s.id in linked_slot_ids
        if not has_link and s.status in ("BOOKED", "GRACE"):
            s.status = "AVAILABLE"
            touched += 1

    db.commit()
    return {"ok": True, "touched": touched}


# ── Host earnings over time ───────────────────────────────────────

@router.get("/earnings")
def get_host_earnings(
    days: int = 30,
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Return daily earnings for the host over the last N days.
    Earnings = 80% of booking total_amount for stations owned by the host.
    """
    host = db.query(Host).filter(Host.id == admin_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    # Get station IDs for this host
    station_ids = [s.id for s in db.query(Station).filter(Station.host_id == admin_id).all()]
    if not station_ids:
        return {"daily": [], "total": 0, "wallet_balance": float(getattr(host, "wallet_balance", 0) or 0)}

    cutoff = datetime.utcnow() - timedelta(days=days)
    bookings = (
        db.query(Booking)
        .filter(
            Booking.station_id.in_(station_ids),
            Booking.created_at >= cutoff,
            Booking.booking_status.in_(["UPCOMING", "ACTIVE", "COMPLETED"]),
        )
        .all()
    )

    daily: dict[str, float] = defaultdict(float)
    total = 0.0
    for b in bookings:
        amt = float(getattr(b, "total_amount", 0) or 0) * 0.80
        day_key = b.created_at.strftime("%Y-%m-%d") if b.created_at else "unknown"
        daily[day_key] += amt
        total += amt

    # Pad missing days with 0
    result = []
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result.append({"date": d, "earnings": round(daily.get(d, 0), 2)})

    return {
        "daily": result,
        "total": round(total, 2),
        "wallet_balance": round(float(getattr(host, "wallet_balance", 0) or 0), 2),
    }


# ── Peak hours analytics ─────────────────────────────────────────

@router.get("/peak-hours")
def get_peak_hours(
    days: int = 30,
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Return booking counts bucketed by hour (0..23) for stations owned by this host."""
    station_ids = [s.id for s in db.query(Station).filter(Station.host_id == admin_id).all()]
    if not station_ids:
        return {"hours": [{"hour": h, "bookings": 0} for h in range(24)]}

    cutoff = datetime.utcnow() - timedelta(days=days)
    bookings = (
        db.query(Booking)
        .filter(
            Booking.station_id.in_(station_ids),
            Booking.created_at >= cutoff,
        )
        .all()
    )

    by_hour: dict[int, int] = defaultdict(int)
    for b in bookings:
        if b.start_time:
            by_hour[b.start_time.hour] += 1

    result = [{"hour": h, "bookings": by_hour.get(h, 0)} for h in range(24)]
    return {"hours": result}


# ── Revenue split summary for a booking ───────────────────────────

@router.get("/revenue-split/{booking_id}")
def get_revenue_split(
    booking_id: str,
    db: Session = Depends(get_db),
):
    """Show the 80/20 revenue split for a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    total = float(getattr(booking, "total_amount", 0) or 0)
    host_share = round(total * 0.80, 2)
    platform_share = round(total * 0.20, 2)

    return {
        "booking_id": booking_id,
        "total_amount": total,
        "host_share": host_share,
        "platform_share": platform_share,
        "host_percentage": 80,
        "platform_percentage": 20,
    }
