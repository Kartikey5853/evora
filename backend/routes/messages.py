from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from dependencies import get_db, get_current_user, get_current_admin
from models.message import Message
from models.booking import Booking
from models.station import Station
from models.user import User
from models.host import Host

router = APIRouter(prefix="/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    receiver_id: str
    receiver_role: str          # "user" | "admin"
    booking_id: Optional[str] = None
    station_id: Optional[str] = None
    content: str


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_role: str
    receiver_id: str
    receiver_role: str
    booking_id: Optional[str] = None
    station_id: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── User sends a message ──────────────────────────────────────────

@router.post("/user", response_model=MessageOut)
def user_send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """User sends a message to the station host.
    
    The frontend sends receiver_id = station_id (since the user doesn't know
    the host's ID). We resolve the actual host_id from the station or booking.
    """
    actual_receiver_id = payload.receiver_id
    station_id = payload.station_id

    # Try to resolve host from station_id or booking
    if payload.station_id:
        station = db.query(Station).filter(Station.id == payload.station_id).first()
        if station and station.host_id:
            actual_receiver_id = station.host_id
    elif payload.booking_id:
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if booking and booking.station_id:
            station = db.query(Station).filter(Station.id == booking.station_id).first()
            if station and station.host_id:
                actual_receiver_id = station.host_id
            station_id = booking.station_id

    # Also try resolving from receiver_id if it looks like a station id
    if actual_receiver_id == payload.receiver_id:
        station = db.query(Station).filter(Station.id == payload.receiver_id).first()
        if station and station.host_id:
            actual_receiver_id = station.host_id
            station_id = station_id or station.id

    msg = Message(
        sender_id=user_id,
        sender_role="user",
        receiver_id=actual_receiver_id,
        receiver_role="admin",
        booking_id=payload.booking_id,
        station_id=station_id,
        content=payload.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# ── Admin/host sends a message ────────────────────────────────────

@router.post("/admin", response_model=MessageOut)
def admin_send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Admin/host sends a message to a user about a booking."""
    station_id = payload.station_id

    # If booking_id provided, fill in station_id
    if payload.booking_id and not station_id:
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if booking:
            station_id = booking.station_id

    msg = Message(
        sender_id=admin_id,
        sender_role="admin",
        receiver_id=payload.receiver_id,
        receiver_role="user",
        booking_id=payload.booking_id,
        station_id=station_id,
        content=payload.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# ── Get conversation for a booking ────────────────────────────────

@router.get("/booking/{booking_id}", response_model=list[MessageOut])
def get_messages_for_booking(
    booking_id: str,
    db: Session = Depends(get_db),
):
    """Get all messages associated with a booking (both directions)."""
    msgs = (
        db.query(Message)
        .filter(Message.booking_id == booking_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return msgs


# ── Get all conversations for current user ────────────────────────

@router.get("/user/threads")
def get_user_threads(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Get all message threads for the current user, grouped by booking_id."""
    msgs = (
        db.query(Message)
        .filter(
            (Message.sender_id == user_id) | (Message.receiver_id == user_id)
        )
        .order_by(Message.created_at.desc())
        .all()
    )

    threads: dict[str, dict] = {}
    for m in msgs:
        key = m.booking_id or m.id
        if key not in threads:
            threads[key] = {
                "booking_id": m.booking_id,
                "station_id": m.station_id,
                "last_message": m.content,
                "last_message_at": m.created_at,
                "other_id": m.receiver_id if m.sender_id == user_id else m.sender_id,
                "other_role": m.receiver_role if m.sender_id == user_id else m.sender_role,
                "message_count": 0,
            }
        threads[key]["message_count"] += 1

    return list(threads.values())


# ── Get all conversations for current admin ───────────────────────

@router.get("/admin/threads")
def get_admin_threads(
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Get all message threads for the current admin/host.
    
    Finds messages where admin is sender or receiver,
    OR where the message's station is owned by this admin.
    """
    # Get station IDs owned by this host
    station_ids = [
        s.id for s in db.query(Station).filter(Station.host_id == admin_id).all()
    ]

    # Find messages where admin is directly involved OR on their stations
    from sqlalchemy import or_
    conditions = [
        Message.sender_id == admin_id,
        Message.receiver_id == admin_id,
    ]
    if station_ids:
        conditions.append(Message.station_id.in_(station_ids))

    msgs = (
        db.query(Message)
        .filter(or_(*conditions))
        .order_by(Message.created_at.desc())
        .all()
    )

    threads: dict[str, dict] = {}
    for m in msgs:
        key = m.booking_id or m.id
        if key not in threads:
            other_id = m.receiver_id if m.sender_id == admin_id else m.sender_id
            other_role = m.receiver_role if m.sender_id == admin_id else m.sender_role
            threads[key] = {
                "booking_id": m.booking_id,
                "station_id": m.station_id,
                "last_message": m.content,
                "last_message_at": m.created_at,
                "other_id": other_id,
                "other_role": other_role,
                "message_count": 0,
            }
        threads[key]["message_count"] += 1

    return list(threads.values())


# ── Admin: list bookings available for chat ───────────────────────

@router.get("/admin/bookings-for-chat")
def get_admin_bookings_for_chat(
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """List active/upcoming bookings at stations owned by this host,
    with user info so the admin can initiate a conversation."""
    station_ids = [
        s.id for s in db.query(Station).filter(Station.host_id == admin_id).all()
    ]
    if not station_ids:
        return []

    bookings = (
        db.query(Booking)
        .filter(
            Booking.station_id.in_(station_ids),
            Booking.booking_status.in_(["UPCOMING", "ACTIVE", "GRACE"]),
        )
        .order_by(Booking.start_time.asc())
        .all()
    )

    result = []
    for b in bookings:
        user = db.query(User).filter(User.id == b.user_id).first()
        result.append({
            "booking_id": b.id,
            "station_id": b.station_id,
            "charger_id": getattr(b, "charger_id", None),
            "user_id": b.user_id,
            "user_name": user.name if user else "Unknown",
            "user_email": user.email if user else "",
            "booking_status": b.booking_status,
            "start_time": b.start_time,
            "end_time": b.end_time,
        })

    return result


# ── Station-level messaging (no booking required) ────────────────

@router.get("/user/stations-for-chat")
def get_user_stations_for_chat(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """List all active stations so the user can message any station host."""
    stations = (
        db.query(Station)
        .filter(Station.is_active == True)
        .order_by(Station.name.asc())
        .all()
    )
    result = []
    for s in stations:
        host = db.query(Host).filter(Host.id == s.host_id).first()
        # Check if there's an existing conversation
        msg_count = (
            db.query(Message)
            .filter(
                Message.station_id == s.id,
                ((Message.sender_id == user_id) | (Message.receiver_id == user_id)),
            )
            .count()
        )
        result.append({
            "station_id": s.id,
            "station_name": s.name,
            "station_address": s.address,
            "host_id": s.host_id,
            "host_name": host.name if host else "Unknown",
            "message_count": msg_count,
        })
    return result


@router.get("/station/{station_id}")
def get_messages_for_station(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Get all messages associated with a station (both directions)."""
    msgs = (
        db.query(Message)
        .filter(Message.station_id == station_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_role": m.sender_role,
            "receiver_id": m.receiver_id,
            "receiver_role": m.receiver_role,
            "booking_id": m.booking_id,
            "station_id": m.station_id,
            "content": m.content,
            "created_at": m.created_at,
        }
        for m in msgs
    ]


@router.get("/admin/station-threads")
def get_admin_station_threads(
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Get all unique user conversations grouped by station for this host."""
    station_ids = [
        s.id for s in db.query(Station).filter(Station.host_id == admin_id).all()
    ]
    if not station_ids:
        return []

    from sqlalchemy import or_
    msgs = (
        db.query(Message)
        .filter(Message.station_id.in_(station_ids))
        .order_by(Message.created_at.desc())
        .all()
    )

    # Group by (station_id, user_id) — each unique user per station is a thread
    threads: dict[tuple[str, str], dict] = {}
    for m in msgs:
        # Determine the user side of the conversation
        if m.sender_role == "user":
            user_id = m.sender_id
        else:
            user_id = m.receiver_id

        key = (m.station_id or "", user_id)
        if key not in threads:
            user = db.query(User).filter(User.id == user_id).first()
            station = db.query(Station).filter(Station.id == m.station_id).first()
            threads[key] = {
                "station_id": m.station_id,
                "station_name": station.name if station else "Unknown",
                "user_id": user_id,
                "user_name": user.name if user else "Unknown",
                "last_message": m.content,
                "last_message_at": m.created_at,
                "message_count": 0,
            }
        threads[key]["message_count"] += 1

    return list(threads.values())


@router.get("/station/{station_id}/user/{user_id}")
def get_station_user_messages(
    station_id: str,
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get all messages between a specific user and station."""
    from sqlalchemy import or_, and_
    msgs = (
        db.query(Message)
        .filter(
            Message.station_id == station_id,
            or_(
                Message.sender_id == user_id,
                Message.receiver_id == user_id,
            ),
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_role": m.sender_role,
            "receiver_id": m.receiver_id,
            "receiver_role": m.receiver_role,
            "booking_id": m.booking_id,
            "station_id": m.station_id,
            "content": m.content,
            "created_at": m.created_at,
        }
        for m in msgs
    ]
