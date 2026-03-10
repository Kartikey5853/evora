from sqlalchemy.orm import Session
from database.database import SessionLocal
from models.booking import Booking
import uuid
from datetime import datetime

DUMMY_USER_ID = "user-001"
DUMMY_CAR_ID = "car-001"
DUMMY_SLOT_ID = "slot-001"
DUMMY_STATION_ID = "station-001"

def seed_bookings():
    db: Session = SessionLocal()

    booking = Booking(
        id=str(uuid.uuid4()),
        user_id=DUMMY_USER_ID,
        car_id=DUMMY_CAR_ID,
        slot_id=DUMMY_SLOT_ID,
        station_id=DUMMY_STATION_ID,
        order_id="ORD-SEED-001",
        transaction_id="TXN-SEED-001",
        ticket_id="TICKET-SEED-001",
        amount=499.0,
        booking_status="UPCOMING",
        created_at=datetime.utcnow()
    )

    db.add(booking)
    db.commit()
    db.close()

    print("✅ Seed booking inserted successfully")

if __name__ == "__main__":
    seed_bookings()
