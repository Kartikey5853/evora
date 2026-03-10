from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
import uuid

from models.base import Base


class Station(Base):
    __tablename__ = "stations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    host_id = Column(String, ForeignKey("hosts.id"), nullable=False)

    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(String, nullable=False)
    longitude = Column(String, nullable=False)

    is_active = Column(Boolean, default=True)

    document_url = Column(String, nullable=True)
    approval_status = Column(String, default="PENDING")  # PENDING | APPROVED | REJECTED

    created_at = Column(DateTime(timezone=True), server_default=func.now())
