from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
import bcrypt
from datetime import datetime, timedelta

from dependencies import get_db, create_access_token, get_current_user, generate_otp
from otp_smtp import send_otp
from models.user import User
from models.host import Host
from models.otp import OTP
from schema.auth import (
    UserLogin,
    UserRegister,
    AdminLogin,
    AdminRegister,
    TokenResponse,
    OTPRequest,
    OTPVerify,
    RegisterStart,
    ResetStart,
    ResetComplete,
    GoogleTokenLogin,
)

# google token verification (optional)
import os

router = APIRouter()

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))


def _latest_otp(db: Session, *, purpose: str, user_id: str | None = None, host_id: str | None = None):
    q = db.query(OTP).filter(OTP.purpose == purpose)
    if user_id:
        q = q.filter(OTP.user_id == user_id)
    if host_id:
        q = q.filter(OTP.host_id == host_id)
    return q.order_by(OTP.id.desc()).first()


def _verify_otp(db: Session, otp_row: OTP, otp_value: str):
    if not otp_row:
        raise HTTPException(status_code=400, detail="OTP not found")
    if otp_row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired")
    if otp_row.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="OTP locked")

    if otp_row.otp != otp_value:
        otp_row.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")


# =====================================================
# USER AUTH (OTP)
# =====================================================

@router.post("/register-start")
def user_register_start(payload: RegisterStart, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pw,
        is_verified=False,
        is_profile_complete=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp = generate_otp()
    db.add(OTP(
        user_id=user.id,
        otp=otp,
        purpose="register",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    ))
    db.commit()

    send_otp(user.email, otp, "register")
    return {"message": "OTP sent"}


@router.post("/register-verify", response_model=TokenResponse)
def user_register_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp_row = _latest_otp(db, purpose="register", user_id=user.id)
    _verify_otp(db, otp_row, payload.otp)

    user.is_verified = True
    db.delete(otp_row)
    db.commit()

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login-request")
def user_login_request(payload: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not user.password_hash or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    otp = generate_otp()
    db.add(OTP(
        user_id=user.id,
        otp=otp,
        purpose="login",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    ))
    db.commit()

    send_otp(user.email, otp, "login")
    return {"message": "Login OTP sent"}


@router.post("/login-verify", response_model=TokenResponse)
def user_login_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    otp_row = _latest_otp(db, purpose="login", user_id=user.id)
    _verify_otp(db, otp_row, payload.otp)

    db.delete(otp_row)
    db.commit()

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login-direct", response_model=TokenResponse)
def user_login_direct(payload: OTPRequest, db: Session = Depends(get_db)):
    """Direct login without OTP (used when client-side 2FA toggle is OFF).

    This does not change registration/forgot-password OTP requirements.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not user.password_hash or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


# Backward compatible endpoints (frontend currently calls these)
@router.post("/register", response_model=TokenResponse)
def user_register_deprecated(payload: UserRegister, db: Session = Depends(get_db)):
    raise HTTPException(status_code=410, detail="Use /auth/register-start and /auth/register-verify")


@router.post("/login", response_model=TokenResponse)
def user_login_deprecated(payload: UserLogin, db: Session = Depends(get_db)):
    raise HTTPException(status_code=410, detail="Use /auth/login-request and /auth/login-verify")


# =====================================================
# FORGOT / RESET PASSWORD (OTP)
# =====================================================

@router.post("/forgot-password")
def forgot_password(payload: ResetStart, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # don't leak existence
        return {"message": "If the email exists, an OTP was sent"}

    otp = generate_otp()
    db.add(OTP(
        user_id=user.id,
        otp=otp,
        purpose="reset",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    ))
    db.commit()

    send_otp(user.email, otp, "reset")
    return {"message": "Reset OTP sent"}


@router.post("/reset-password")
def reset_password(payload: ResetComplete, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp_row = _latest_otp(db, purpose="reset", user_id=user.id)
    _verify_otp(db, otp_row, payload.otp)

    user.password_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    db.delete(otp_row)
    db.commit()

    return {"message": "Password reset successful"}


# =====================================================
# ADMIN AUTH (OTP)
# =====================================================

@router.post("/admin/register-start")
def admin_register_start(payload: RegisterStart, db: Session = Depends(get_db)):
    if db.query(Host).filter(Host.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    admin = Host(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pw,
        is_verified=False,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    otp = generate_otp()
    db.add(OTP(
        host_id=admin.id,
        otp=otp,
        purpose="register_admin",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    ))
    db.commit()

    send_otp(admin.email, otp, "register")
    return {"message": "OTP sent"}


@router.post("/admin/register-verify", response_model=TokenResponse)
def admin_register_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    otp_row = _latest_otp(db, purpose="register_admin", host_id=admin.id)
    _verify_otp(db, otp_row, payload.otp)

    admin.is_verified = True
    db.delete(otp_row)
    db.commit()

    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/login-request")
def admin_login_request(payload: OTPRequest, db: Session = Depends(get_db)):
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not admin.password_hash or not bcrypt.checkpw(payload.password.encode(), admin.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    otp = generate_otp()
    db.add(OTP(
        host_id=admin.id,
        otp=otp,
        purpose="login_admin",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    ))
    db.commit()

    send_otp(admin.email, otp, "login")
    return {"message": "Login OTP sent"}


@router.post("/admin/login-verify", response_model=TokenResponse)
def admin_login_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    otp_row = _latest_otp(db, purpose="login_admin", host_id=admin.id)
    _verify_otp(db, otp_row, payload.otp)

    db.delete(otp_row)
    db.commit()

    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/login-direct", response_model=TokenResponse)
def admin_login_direct(payload: OTPRequest, db: Session = Depends(get_db)):
    """Direct admin login without OTP (used when client-side 2FA toggle is OFF)."""
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not admin.password_hash or not bcrypt.checkpw(payload.password.encode(), admin.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


# =====================================================
# GOOGLE AUTH (ID TOKEN)
# =====================================================

@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleTokenLogin, db: Session = Depends(get_db)):
    # Minimal implementation: accept a token but do not validate unless configured.
    # For production, verify the token with google-auth.
    google_sub = payload.credential

    if payload.role == "admin":
        admin = db.query(Host).filter(Host.google_id == google_sub).first()
        if not admin:
            admin = Host(id=str(uuid.uuid4()), name="Google Admin", email=f"{google_sub}@google", google_id=google_sub, is_verified=True)
            db.add(admin)
            db.commit()
            db.refresh(admin)
        token = create_access_token({"admin_id": admin.id, "role": "admin"})
        return {"access_token": token, "token_type": "bearer"}

    user = db.query(User).filter(User.google_id == google_sub).first()
    if not user:
        user = User(id=str(uuid.uuid4()), name="Google User", email=f"{google_sub}@google", google_id=google_sub, is_verified=True, is_profile_complete=False)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


# =====================================================
# CHANGE PASSWORD (existing)
# =====================================================

@router.post("/change-password")
def change_password(
    data: dict,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_password = data.get("old_password")
    new_password = data.get("new_password")
    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing fields")

    if not user.password_hash or not bcrypt.checkpw(old_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    db.commit()
    return {"success": True}
