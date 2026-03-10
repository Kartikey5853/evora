from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from dependencies import get_db, get_current_user, get_current_admin
from models.user import User
from models.host import Host
from models.wallet_transaction import WalletTransaction

router = APIRouter(prefix="/wallet", tags=["Wallet"])


class AddFundsRequest(BaseModel):
    amount: float


class WalletTransactionOut(BaseModel):
    id: str
    user_id: str
    type: str
    amount: float
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── User wallet ──────────────────────────────────────────────────

@router.get("/balance")
def get_balance(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    balance = float(getattr(user, "wallet_balance", 0) or 0)
    return {"balance": balance}


@router.post("/add-funds")
def add_funds(
    payload: AddFundsRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if payload.amount > 50000:
        raise HTTPException(status_code=400, detail="Max single top-up is 50,000 EV Points")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.wallet_balance = float(getattr(user, "wallet_balance", 0) or 0) + payload.amount

    txn = WalletTransaction(
        user_id=user_id,
        type="CREDIT",
        amount=payload.amount,
        description=f"Added {payload.amount} EV Points",
    )
    db.add(txn)
    db.commit()
    db.refresh(user)

    return {"ok": True, "balance": user.wallet_balance}


@router.get("/transactions", response_model=list[WalletTransactionOut])
def get_transactions(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    txns = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user_id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return txns


# ── Host/Admin wallet ────────────────────────────────────────────

@router.get("/host/balance")
def get_host_balance(
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    host = db.query(Host).filter(Host.id == admin_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    balance = float(getattr(host, "wallet_balance", 0) or 0)
    return {"balance": balance}


@router.post("/host/withdraw")
def host_withdraw(
    payload: AddFundsRequest,
    db: Session = Depends(get_db),
    admin_id: str = Depends(get_current_admin),
):
    """Placeholder for host bank withdrawal — Razorpay integration coming soon."""
    raise HTTPException(
        status_code=400,
        detail="Bank withdrawals via Razorpay are coming soon. Your balance is safe and will be transferable once integration is complete.",
    )
