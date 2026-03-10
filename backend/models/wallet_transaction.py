from sqlalchemy import Column, String, DateTime, Float
from sqlalchemy.sql import func
import uuid

from models.base import Base


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # CREDIT | DEBIT
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
