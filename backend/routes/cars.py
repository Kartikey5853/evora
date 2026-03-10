from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dependencies import get_db, get_current_user
from models.car import Car
from schema.car import CarCreate, CarOut, EmergencyCarCreate

router = APIRouter(tags=["Cars"])


@router.get("/", response_model=list[CarOut])
def get_my_cars(
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    query = db.query(Car)

    if user_id:
        query = query.filter(Car.user_id == user_id)

    return query.all()


@router.get("/bookable", response_model=list[CarOut])
def get_bookable_cars(
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    """Return cars eligible for booking: all regular cars + only APPROVED emergency cars."""
    query = db.query(Car)

    if user_id:
        query = query.filter(Car.user_id == user_id)

    all_cars = query.all()
    return [
        c for c in all_cars
        if not c.is_emergency or c.emergency_status == "APPROVED"
    ]


@router.post("/", response_model=CarOut)
def add_car(
    car: CarCreate,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    new_car = Car(
        user_id=user_id,
        brand=car.brand,
        model=car.model,
        car_number=car.car_number,
        charger_type=car.charger_type,
    )

    db.add(new_car)
    db.commit()
    db.refresh(new_car)
    return new_car


@router.post("/emergency", response_model=CarOut)
def add_emergency_car(
    car: EmergencyCarCreate,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    """Register an emergency vehicle. Requires superadmin approval before it can be used."""
    new_car = Car(
        user_id=user_id,
        brand=car.brand,
        model=car.model,
        car_number=car.car_number,
        charger_type=car.charger_type,
        is_emergency=True,
        emergency_type=car.emergency_type,
        emergency_proof_url=car.emergency_proof_url,
        emergency_status="PENDING",
    )

    db.add(new_car)
    db.commit()
    db.refresh(new_car)
    return new_car


@router.delete("/{car_id}")
def delete_car(
    car_id: str,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user),
):
    query = db.query(Car).filter(Car.id == car_id)

    if user_id:
        query = query.filter(Car.user_id == user_id)

    car = query.first()

    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    db.delete(car)
    db.commit()

    return {"status": "ok"}
