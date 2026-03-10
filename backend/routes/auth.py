from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
import bcrypt
from datetime import datetime, timedelta

from dependencies import get_db, create_access_token, get_current_user, generate_otp
# OTP_DISABLED: from otp_smtp import send_otp
from models.user import User
from models.host import Host
# OTP_DISABLED: from models.otp import OTP
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

# OTP_DISABLED: OTP flow is turned off for production launch.
# To re-enable, uncomment OTP imports above and restore OTP blocks below.
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))


# OTP_DISABLED: helper kept for future re-enable
# def _latest_otp(db, *, purpose, user_id=None, host_id=None):
#     from models.otp import OTP
#     q = db.query(OTP).filter(OTP.purpose == purpose)
#     if user_id: q = q.filter(OTP.user_id == user_id)
#     if host_id: q = q.filter(OTP.host_id == host_id)
#     return q.order_by(OTP.id.desc()).first()

# def _verify_otp(db, otp_row, otp_value):
#     from models.otp import OTP
#     if not otp_row: raise HTTPException(400, "OTP not found")
#     if otp_row.expires_at < datetime.utcnow(): raise HTTPException(400, "OTP expired")
#     if otp_row.attempts >= OTP_MAX_ATTEMPTS: raise HTTPException(400, "OTP locked")
#     if otp_row.otp != otp_value:
#         otp_row.attempts += 1; db.commit()
#         raise HTTPException(400, "Invalid OTP")


# =====================================================
# USER AUTH — OTP DISABLED, DIRECT REGISTER/LOGIN
# =====================================================

@router.post("/register-start", response_model=TokenResponse)
def user_register_start(payload: RegisterStart, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pw,
        is_verified=True,          # OTP_DISABLED: auto-verify on register
        is_profile_complete=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # OTP_DISABLED: skip OTP generation and email send
    # otp = generate_otp()
    # db.add(OTP(user_id=user.id, otp=otp, purpose="register",
    #            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    # db.commit()
    # send_otp(user.email, otp, "register")
    # return {"message": "OTP sent"}

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register-verify", response_model=TokenResponse)
def user_register_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    # OTP_DISABLED: OTP verify step skipped — just issue token for verified user
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    db.commit()
    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}
    # OTP_DISABLED original block:
    # otp_row = _latest_otp(db, purpose="register", user_id=user.id)
    # _verify_otp(db, otp_row, payload.otp)
    # user.is_verified = True
    # db.delete(otp_row)
    # db.commit()


@router.post("/login-request", response_model=TokenResponse)
def user_login_request(payload: OTPRequest, db: Session = Depends(get_db)):
    # OTP_DISABLED: direct login — no OTP step
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not user.password_hash or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # OTP_DISABLED original block:
    # otp = generate_otp()
    # db.add(OTP(user_id=user.id, otp=otp, purpose="login",
    #            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    # db.commit()
    # send_otp(user.email, otp, "login")
    # return {"message": "Login OTP sent"}

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login-verify", response_model=TokenResponse)
def user_login_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    # OTP_DISABLED: just do a direct login
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}
    # OTP_DISABLED original block:
    # otp_row = _latest_otp(db, purpose="login", user_id=user.id)
    # _verify_otp(db, otp_row, payload.otp)
    # db.delete(otp_row); db.commit()


@router.post("/login-direct", response_model=TokenResponse)
def user_login_direct(payload: OTPRequest, db: Session = Depends(get_db)):
    """Direct login without OTP."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not user.password_hash or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


# Backward compatible endpoints — now fully functional
@router.post("/register", response_model=TokenResponse)
def user_register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pw,
        is_verified=True,
        is_profile_complete=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def user_login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not user.password_hash or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"user_id": user.id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}


# =====================================================
# FORGOT / RESET PASSWORD (OTP DISABLED)
# =====================================================

@router.post("/forgot-password")
def forgot_password(payload: ResetStart, db: Session = Depends(get_db)):
    # OTP_DISABLED: OTP email send skipped. Reset requires /reset-password with new password only.
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"message": "If the email exists, use /reset-password directly"}
    return {"message": "Use /reset-password with your new password"}
    # OTP_DISABLED original block:
    # otp = generate_otp()
    # db.add(OTP(user_id=user.id, otp=otp, purpose="reset",
    #            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    # db.commit()
    # send_otp(user.email, otp, "reset")


@router.post("/reset-password")
def reset_password(payload: ResetComplete, db: Session = Depends(get_db)):
    # OTP_DISABLED: skip OTP check, directly reset password
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # OTP_DISABLED original block:
    # otp_row = _latest_otp(db, purpose="reset", user_id=user.id)
    # _verify_otp(db, otp_row, payload.otp)
    # db.delete(otp_row)

    user.password_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    db.commit()
    return {"message": "Password reset successful"}


# =====================================================
# ADMIN AUTH — OTP DISABLED, DIRECT REGISTER/LOGIN
# =====================================================

@router.post("/admin/register-start", response_model=TokenResponse)
def admin_register_start(payload: RegisterStart, db: Session = Depends(get_db)):
    if db.query(Host).filter(Host.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    admin = Host(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pw,
        is_verified=True,          # OTP_DISABLED: auto-verify on register
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    # OTP_DISABLED original block:
    # otp = generate_otp()
    # db.add(OTP(host_id=admin.id, otp=otp, purpose="register_admin",
    #            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    # db.commit()
    # send_otp(admin.email, otp, "register")
    # return {"message": "OTP sent"}

    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/register-verify", response_model=TokenResponse)
def admin_register_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    # OTP_DISABLED: just issue token for verified admin
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    admin.is_verified = True
    db.commit()
    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}
    # OTP_DISABLED original block:
    # otp_row = _latest_otp(db, purpose="register_admin", host_id=admin.id)
    # _verify_otp(db, otp_row, payload.otp)
    # admin.is_verified = True; db.delete(otp_row); db.commit()


@router.post("/admin/login-request", response_model=TokenResponse)
def admin_login_request(payload: OTPRequest, db: Session = Depends(get_db)):
    # OTP_DISABLED: direct login
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    if not admin.password_hash or not bcrypt.checkpw(payload.password.encode(), admin.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # OTP_DISABLED original block:
    # otp = generate_otp()
    # db.add(OTP(host_id=admin.id, otp=otp, purpose="login_admin",
    #            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    # db.commit()
    # send_otp(admin.email, otp, "login")
    # return {"message": "Login OTP sent"}

    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/login-verify", response_model=TokenResponse)
def admin_login_verify(payload: OTPVerify, db: Session = Depends(get_db)):
    # OTP_DISABLED: just do a direct login
    admin = db.query(Host).filter(Host.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified")
    token = create_access_token({"admin_id": admin.id, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}
    # OTP_DISABLED original block:
    # otp_row = _latest_otp(db, purpose="login_admin", host_id=admin.id)
    # _verify_otp(db, otp_row, payload.otp)
    # db.delete(otp_row); db.commit()


@router.post("/admin/login-direct", response_model=TokenResponse)
def admin_login_direct(payload: OTPRequest, db: Session = Depends(get_db)):
    """Direct admin login without OTP."""
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
