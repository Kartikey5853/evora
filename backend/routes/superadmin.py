from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dependencies import get_db, create_access_token
from models.car import Car
from models.user import User
from models.station import Station
from models.host import Host

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])

# Hardcoded superadmin credentials
SUPERADMIN_EMAIL = "evora@gmail.com"
SUPERADMIN_PASSWORD = "123456"


class SuperAdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def superadmin_login(payload: SuperAdminLoginRequest):
    """Superadmin login with hardcoded credentials."""
    if payload.email != SUPERADMIN_EMAIL or payload.password != SUPERADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid superadmin credentials")

    token = create_access_token(
        data={"admin_id": "superadmin", "role": "superadmin"}
    )
    return {"access_token": token, "role": "superadmin"}


@router.get("/emergency-requests")
def list_emergency_requests(db: Session = Depends(get_db)):
    """List all emergency vehicle registration requests (all statuses)."""
    cars = (
        db.query(Car, User)
        .join(User, User.id == Car.user_id)
        .filter(Car.is_emergency == True)
        .order_by(Car.created_at.desc())
        .all()
    )

    return [
        {
            "car_id": car.id,
            "brand": car.brand,
            "model": car.model,
            "car_number": car.car_number,
            "charger_type": car.charger_type,
            "emergency_type": car.emergency_type,
            "emergency_proof_url": car.emergency_proof_url,
            "emergency_status": car.emergency_status,
            "created_at": car.created_at,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
        }
        for car, user in cars
    ]


@router.post("/emergency-requests/{car_id}/approve")
def approve_emergency_request(car_id: str, db: Session = Depends(get_db)):
    """Approve an emergency vehicle registration request."""
    car = db.query(Car).filter(Car.id == car_id, Car.is_emergency == True).first()
    if not car:
        raise HTTPException(status_code=404, detail="Emergency vehicle not found")
    if car.emergency_status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve — current status is {car.emergency_status}")

    car.emergency_status = "APPROVED"
    db.commit()
    return {"ok": True, "car_id": car_id, "emergency_status": "APPROVED"}


@router.post("/emergency-requests/{car_id}/reject")
def reject_emergency_request(car_id: str, db: Session = Depends(get_db)):
    """Reject an emergency vehicle registration request."""
    car = db.query(Car).filter(Car.id == car_id, Car.is_emergency == True).first()
    if not car:
        raise HTTPException(status_code=404, detail="Emergency vehicle not found")
    if car.emergency_status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot reject — current status is {car.emergency_status}")

    car.emergency_status = "REJECTED"
    db.commit()
    return {"ok": True, "car_id": car_id, "emergency_status": "REJECTED"}


# ── Station approval endpoints ────────────────────────────────────

@router.get("/station-requests")
def list_station_requests(db: Session = Depends(get_db)):
    """List all station approval requests (all statuses)."""
    stations = (
        db.query(Station, Host)
        .join(Host, Host.id == Station.host_id)
        .order_by(Station.created_at.desc())
        .all()
    )
    return [
        {
            "station_id": s.id,
            "name": s.name,
            "address": s.address,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "document_url": s.document_url,
            "approval_status": getattr(s, "approval_status", "APPROVED"),
            "is_active": s.is_active,
            "created_at": s.created_at,
            "host": {
                "id": h.id,
                "name": h.name,
                "email": h.email,
            },
        }
        for s, h in stations
    ]


@router.post("/station-requests/{station_id}/approve")
def approve_station(station_id: str, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if getattr(station, "approval_status", None) != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve — status is {station.approval_status}")
    station.approval_status = "APPROVED"
    station.is_active = True
    db.commit()
    return {"ok": True, "station_id": station_id, "approval_status": "APPROVED"}


@router.post("/station-requests/{station_id}/reject")
def reject_station(station_id: str, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if getattr(station, "approval_status", None) != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot reject — status is {station.approval_status}")
    station.approval_status = "REJECTED"
    station.is_active = False
    db.commit()
    return {"ok": True, "station_id": station_id, "approval_status": "REJECTED"}
