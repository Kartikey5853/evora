from schema.base import BaseSchema
from datetime import datetime
from typing import Optional


class BookingCreateV2(BaseSchema):
    charger_id: str
    station_id: str
    car_id: str

    # YYYY-MM-DD from UI + HH:MM strings from UI
    date: str
    start_time: str
    duration_minutes: int = 30


class BookingCreateV2Out(BaseSchema):
    booking_id: str
    ticket_id: str
    amount: float
    host_share: float = 0.0
    platform_share: float = 0.0
    start_time: datetime
    end_time: datetime


class BookingScanRequest(BaseSchema):
    bypass_mode: bool = False
