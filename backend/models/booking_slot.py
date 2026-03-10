from sqlalchemy import Column, String, ForeignKey, Float
import uuid

from models.base import Base


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    slot_id = Column(String, ForeignKey("slots.id"), nullable=False)
    price = Column(Float, nullable=False)
