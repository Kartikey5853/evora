from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
import uuid

from models.base import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    user_id = Column(String, ForeignKey("users.id"))
    station_id = Column(String, ForeignKey("stations.id"))
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=True)

    # Continuous booking time range (UTC naive)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    car_id = Column(String, ForeignKey("cars.id"), nullable=True)

    order_id = Column(String, unique=True, nullable=True)
    transaction_id = Column(String, nullable=True)
    ticket_id = Column(String, unique=True, nullable=True)

    total_amount = Column(Float, nullable=True)
    amount = Column(Float, nullable=True)    # booking_status: UPCOMING | GRACE | ACTIVE | COMPLETED | NO_SHOW | CANCELLED | OVERRIDDEN
    booking_status = Column(String, default="UPCOMING")

    # Priority (kept for compatibility, not part of lifecycle spec)
    priority = Column(String, default="NORMAL")

    # Emergency override tracking
    was_overridden = Column(Boolean, default=False, nullable=False)
    overridden_by_booking_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())