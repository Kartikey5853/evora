from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db
from models.charger import Charger
from schema.charger import ChargerCreate, ChargerOut

router = APIRouter(prefix="/chargers", tags=["Chargers"]) 


@router.post("/", response_model=ChargerOut)
def create_charger(payload: ChargerCreate, db: Session = Depends(get_db)):
    charger = Charger(
        station_id=payload.station_id,
        name=payload.name,
        charger_type=payload.charger_type,
        power_output_kw=payload.power_output_kw,
        default_price_30min=payload.default_price_30min,
    )
    db.add(charger)
    db.commit()
    db.refresh(charger)
    return charger


@router.get("/by-station/{station_id}", response_model=list[ChargerOut])
def get_chargers_by_station(station_id: str, db: Session = Depends(get_db)):
    return (
        db.query(Charger)
        .filter(Charger.station_id == station_id, Charger.is_active == True)
        .all()
    )


@router.patch("/{charger_id}/disable")
def disable_charger(charger_id: str, db: Session = Depends(get_db)):
    charger = db.query(Charger).filter(Charger.id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    charger.is_active = False
    db.commit()
    return {"ok": True}
