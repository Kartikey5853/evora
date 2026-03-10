from schema.base import BaseSchema
from datetime import datetime
from typing import Optional, Literal

SlotStatus = Literal[
    "AVAILABLE",
    "BOOKED",
    "GRACE",
    "DISABLED",
]


class SlotGenerateRequest(BaseSchema):
    open_time: str   # HH:MM
    close_time: str  # HH:MM
    price_override: Optional[float] = None


class SlotWindowOut(BaseSchema):
    start: datetime
    end: datetime
    status: Literal["AVAILABLE", "PARTIAL", "BOOKED", "DISABLED"]
    available_from: Optional[datetime] = None
    free_micro_slots: int
    recently_released: bool = False
    is_emergency_slot: bool = False
    price: Optional[float] = None


class SlotOut(BaseSchema):
    id: str
    charger_id: str
    start_time: datetime
    end_time: datetime
    status: str  # may include derived EXPIRED
    price_override: Optional[float] = None
    recently_released: bool = False
    is_emergency_slot: bool = False


class SlotPatchRequest(BaseSchema):
    status: Optional[Literal["AVAILABLE", "BOOKED", "GRACE", "DISABLED"]] = None
    price_override: Optional[float] = None
    is_emergency_slot: Optional[bool] = None
