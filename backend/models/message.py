from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
import uuid

from models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    sender_id = Column(String, nullable=False)
    sender_role = Column(String, nullable=False)     # "user" | "admin"

    receiver_id = Column(String, nullable=False)
    receiver_role = Column(String, nullable=False)   # "user" | "admin"

    booking_id = Column(String, nullable=True)       # optional: ties message to a booking
    station_id = Column(String, nullable=True)       # station context

    content = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
