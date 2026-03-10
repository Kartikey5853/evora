from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
import uuid

from models.base import Base


class Slot(Base):
    __tablename__ = "slots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # Slot.status: AVAILABLE | BOOKED | GRACE | DISABLED
    # EXPIRED is never stored — it is derived when end_time < now.
    status = Column(String, default="AVAILABLE", nullable=False)

    # Set when a GRACE no-show releases this slot; used for recently_released hint.
    released_at = Column(DateTime, nullable=True)
    price_override = Column(Float, nullable=True)

    # Emergency vehicle slot flag
    is_emergency_slot = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
