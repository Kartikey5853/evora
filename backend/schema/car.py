from schema.base import BaseSchema
from datetime import datetime
from typing import Optional, Literal


class CarCreate(BaseSchema):
    brand: str
    model: str
    car_number: str
    charger_type: str


class EmergencyCarCreate(BaseSchema):
    brand: str
    model: str
    car_number: str
    charger_type: str
    emergency_type: Literal["POLICE", "AMBULANCE", "FIRE"]
    emergency_proof_url: str


class CarOut(BaseSchema):
    id: str
    brand: str
    model: str
    car_number: str
    charger_type: str
    is_emergency: bool = False
    emergency_type: Optional[str] = None
    emergency_proof_url: Optional[str] = None
    emergency_status: Optional[str] = None
    created_at: datetime
