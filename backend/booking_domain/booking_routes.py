from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db
from schema.booking_engine import BookingScanRequest
from booking_domain.booking_service import (
    create_booking,
    cancel_booking,
    scan_booking,
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("/")
def create(payload: dict, db: Session = Depends(get_db)):
    try:
        b = create_booking(
            db,
            user_id=payload["user_id"],
            charger_id=payload["charger_id"],
            slot_ids=payload["slot_ids"],
            station_id=payload.get("station_id"),
            car_id=payload.get("car_id"),
            total_amount=payload.get("total_amount"),
            priority=payload.get("priority", "NORMAL"),
            make_active=False,
        )
        db.commit()
        return {
            "booking_id": b.id,
            "ticket_id": b.ticket_id,
            "booking_status": b.booking_status,
            "start_time": b.start_time,
            "end_time": b.end_time,
        }
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/walk-in")
def walk_in(payload: dict, db: Session = Depends(get_db)):
    try:
        b = create_booking(
            db,
            user_id=payload["user_id"],
            charger_id=payload["charger_id"],
            slot_ids=payload["slot_ids"],
            station_id=payload.get("station_id"),
            car_id=payload.get("car_id"),
            total_amount=payload.get("total_amount"),
            priority=payload.get("priority", "NORMAL"),
            make_active=True,
        )
        db.commit()
        return {
            "booking_id": b.id,
            "ticket_id": b.ticket_id,
            "booking_status": b.booking_status,
            "start_time": b.start_time,
            "end_time": b.end_time,
        }
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/cancel")
def cancel(booking_id: str, db: Session = Depends(get_db)):
    try:
        b = cancel_booking(db, booking_id)
        db.commit()
        return {"ok": True, "booking_id": b.id, "booking_status": b.booking_status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/scan")
def scan(booking_id: str, payload: BookingScanRequest, db: Session = Depends(get_db)):
    """QR scan endpoint.

    bypass_mode=true  → immediately ACTIVE.
    bypass_mode=false → only within [start_time, end_time].
    """
    try:
        b = scan_booking(db, booking_id, bypass_mode=payload.bypass_mode)
        db.commit()
        return {"ok": True, "booking_id": b.id, "booking_status": b.booking_status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
