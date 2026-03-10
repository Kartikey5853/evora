from schema.base import BaseSchema


class ChargerCreate(BaseSchema):
    station_id: str
    name: str
    charger_type: str
    power_output_kw: float
    default_price_30min: float


class ChargerOut(BaseSchema):
    id: str
    station_id: str
    name: str
    charger_type: str
    power_output_kw: float
    default_price_30min: float
    is_active: bool

    class Config:
        from_attributes = True
