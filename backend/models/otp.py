from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from datetime import datetime

from models.base import Base


class OTP(Base):
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)

    # can belong to either user or host (admin)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    host_id = Column(String, ForeignKey("hosts.id"), nullable=True)

    otp = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # register / login / reset

    attempts = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    def is_expired(self) -> bool:
        # sqlite stores naive; compare in UTC-naive
        exp = self.expires_at
        if isinstance(exp, datetime):
            return exp < datetime.utcnow()
        return True
