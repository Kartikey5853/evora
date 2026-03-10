from schema.base import BaseSchema
from datetime import datetime


class StationCreate(BaseSchema):
    name: str
    address: str
    latitude: str
    longitude: str
    host_id: str
    document_url: str = ""


class StationOut(BaseSchema):
    id: str
    name: str
    address: str
    latitude: str
    longitude: str
    is_active: bool
    document_url: str | None = None
    approval_status: str | None = None
    created_at: datetime
