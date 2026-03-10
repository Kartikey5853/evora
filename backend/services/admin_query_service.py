"""Admin query service — read-only views grouped by Booking.booking_status.

Admin must read from the Booking table (not Slot.status alone).
Slots are joined for display context only.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.booking import Booking
from models.booking_slot import BookingSlot
from models.slot import Slot
from models.charger import Charger
from models.station import Station
from models.car import Car
from models.user import User


def _utcnow() -> datetime:
    return datetime.utcnow()


def _booking_to_dict(b: Booking, slots: list[dict], *, charger: Charger | None = None, station: Station | None = None,
                     user: User | None = None, car: Car | None = None) -> dict:
    return {
        "booking_id": b.id,
        "ticket_id": getattr(b, "ticket_id", None),
        "user_id": b.user_id,
        "user_name": getattr(user, "name", None) if user else None,
        "user_email": getattr(user, "email", None) if user else None,
        "station_id": getattr(b, "station_id", None),
        "station_name": getattr(station, "name", None) if station else None,
        "charger_id": getattr(b, "charger_id", None),
        "charger_name": getattr(charger, "name", None) if charger else None,
        "charger_type": getattr(charger, "charger_type", None) if charger else None,
        "car_id": getattr(b, "car_id", None),
        "car_number": getattr(car, "car_number", None) if car else None,
        "car_brand": getattr(car, "brand", None) if car else None,
        "car_model": getattr(car, "model", None) if car else None,
        "start_time": b.start_time,
        "end_time": b.end_time,        "booking_status": b.booking_status,
        "total_amount": getattr(b, "total_amount", None),
        "created_at": getattr(b, "created_at", None),
        "was_overridden": getattr(b, "was_overridden", False),
        "overridden_by_booking_id": getattr(b, "overridden_by_booking_id", None),
        "slots": slots,
    }


def _get_bookings_with_slots(
    db: Session,
    status_filter: str,
    station_id: Optional[str] = None,
    date: Optional[str] = None,
) -> list[dict]:
    """Fetch bookings by booking_status.

    Admin view must read bookings from Booking table. Slot joins are display-only.
    """

    q = (
        db.query(Booking, Charger, Station, User, Car)
        .outerjoin(Charger, Charger.id == Booking.charger_id)
        .outerjoin(Station, Station.id == Booking.station_id)
        .outerjoin(User, User.id == Booking.user_id)
        .outerjoin(Car, Car.id == Booking.car_id)
        .filter(Booking.booking_status == status_filter)
    )

    if station_id and station_id != "all":
        q = q.filter(Booking.station_id == station_id)

    if date:
        from datetime import time as dt_time
        try:
            day = datetime.strptime(date, "%Y-%m-%d").date()
        except Exception:
            return []
        q = q.filter(
            Booking.start_time >= datetime.combine(day, dt_time.min),
            Booking.start_time <= datetime.combine(day, dt_time.max),
        )

    bookings = q.order_by(Booking.start_time.asc()).all()
    results = []

    for b, charger, station, user, car in bookings:
        slot_rows = (
            db.query(Slot, BookingSlot)
            .join(BookingSlot, BookingSlot.slot_id == Slot.id)
            .filter(BookingSlot.booking_id == b.id)
            .order_by(Slot.start_time.asc())
            .all()
        )

        slot_dicts = [
            {
                "slot_id": s.id,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "status": s.status,
                "price": bs.price,
            }
            for s, bs in slot_rows
        ]

        results.append(_booking_to_dict(b, slot_dicts, charger=charger, station=station, user=user, car=car))

    return results


def get_admin_bookings_grouped(
    db: Session,
    station_id: Optional[str] = None,
    date: Optional[str] = None,
) -> dict:
    """Return bookings grouped into the 6 admin sections.

    ACTIVE BOOKINGS:    booking_status == ACTIVE
    UPCOMING BOOKINGS:  booking_status == UPCOMING
    GRACE BOOKINGS:     booking_status == GRACE
    COMPLETED BOOKINGS: booking_status == COMPLETED
    CANCELLED BOOKINGS: booking_status == CANCELLED
    NO_SHOW BOOKINGS:   booking_status == NO_SHOW
    """
    return {
        "active": _get_bookings_with_slots(db, "ACTIVE", station_id, date),
        "upcoming": _get_bookings_with_slots(db, "UPCOMING", station_id, date),
        "grace": _get_bookings_with_slots(db, "GRACE", station_id, date),
        "completed": _get_bookings_with_slots(db, "COMPLETED", station_id, date),
        "cancelled": _get_bookings_with_slots(db, "CANCELLED", station_id, date),
        "no_show": _get_bookings_with_slots(db, "NO_SHOW", station_id, date),
        "overridden": _get_bookings_with_slots(db, "OVERRIDDEN", station_id, date),
    }
