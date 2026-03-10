from sqlalchemy import Column, String, ForeignKey, Float, Boolean, DateTime
from sqlalchemy.sql import func
import uuid

from models.base import Base


class Charger(Base):
    __tablename__ = "chargers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)

    # Newer fields (make nullable for backward-compat with existing DB schema)
    name = Column(String, nullable=True)
    charger_type = Column(String, nullable=False)

    power_output_kw = Column(Float, nullable=True)
    default_price_30min = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # legacy fields kept for compatibility with older code/DBs
    power_kw = Column(String, nullable=True)
    price_per_hour = Column(Float, nullable=True)