import warnings
warnings.filterwarnings("ignore")
import sys
from main import app

routes = [r.path for r in app.routes if hasattr(r, 'path')]
sys.stderr.write(f"Total routes: {len(routes)}\n")

checks = [
    "/messages/user/stations-for-chat",
    "/messages/admin/station-threads",
    "/messages/station/{station_id}/user/{user_id}",
    "/wallet/balance",
    "/wallet/host/balance",
    "/dev/force-complete/{booking_id}",
]
for c in checks:
    status = "FOUND" if c in routes else "MISSING"
    sys.stderr.write(f"  {c}: {status}\n")
