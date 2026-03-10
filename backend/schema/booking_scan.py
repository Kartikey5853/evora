from schema.base import BaseSchema
from typing import Optional


class BookingScanValidateRequest(BaseSchema):
    ticket_id: Optional[str] = None
    booking_id: Optional[str] = None


class BookingScanValidateOut(BaseSchema):
    ok: bool = True
    booking_id: str
    ticket_id: Optional[str] = None
    station_id: str
    charger_id: Optional[str] = None
    start_time: str
    end_time: str
