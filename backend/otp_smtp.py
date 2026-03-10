import os
import smtplib
import socket
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Ensure we load backend/.env (works no matter where uvicorn is started)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "465"))

# If true, OTP will be printed to console (useful if SMTP not configured)
OTP_DEV_CONSOLE = os.getenv("OTP_DEV_CONSOLE", "false").lower() in {"1", "true", "yes"}


def _send_email(to_email: str, subject: str, body: str):
    if not EMAIL_USER or not EMAIL_PASS:
        if OTP_DEV_CONSOLE:
            return
        raise RuntimeError("EMAIL_USER/EMAIL_PASS not set")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = EMAIL_USER
    msg["To"] = to_email

    try:
        print(f"[SMTP] sending to={to_email} host={EMAIL_HOST}:{EMAIL_PORT} user={EMAIL_USER}")
        with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT, timeout=10) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
            print("[SMTP] sent")
    except socket.gaierror as e:
        if OTP_DEV_CONSOLE:
            return
        raise RuntimeError(
            f"SMTP host resolution failed for EMAIL_HOST={EMAIL_HOST}. "
            f"Use EMAIL_HOST=smtp.gmail.com (Gmail) or enable OTP_DEV_CONSOLE=true. Details: {e}"
        )
    except smtplib.SMTPAuthenticationError as e:
        if OTP_DEV_CONSOLE:
            return
        raise RuntimeError(
            "SMTP authentication failed. For Gmail you must use an App Password and ensure the account allows SMTP. "
            f"Details: {e}"
        )
    except Exception as e:
        if OTP_DEV_CONSOLE:
            return
        raise


def send_otp(to_email: str, otp: str, purpose: str):
    purpose = purpose.lower()
    if purpose == "register":
        subject = "Evora Account Verification"
        body = f"""Welcome to Evora\n\nYour verification OTP is: {otp}\n\nThis OTP expires in 5 minutes."""
    elif purpose == "login":
        subject = "Evora Login Verification"
        body = f"""Evora Security Check\n\nYour login OTP is: {otp}\n\nThis OTP expires in 5 minutes."""
    elif purpose == "reset":
        subject = "Evora Password Reset"
        body = f"""You requested a password reset.\n\nYour OTP is: {otp}\n\nThis OTP expires in 5 minutes."""
    else:
        subject = "Evora OTP"
        body = f"Your OTP is: {otp}"

    if OTP_DEV_CONSOLE:
        print(f"[OTP_DEV_CONSOLE] to={to_email} purpose={purpose} otp={otp}")
        return

    _send_email(to_email, subject, body)
