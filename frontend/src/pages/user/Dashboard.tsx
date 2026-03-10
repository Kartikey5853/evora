import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stationAPI, carAPI, bookingAPI, walletAPI } from '../../lib/api';
import { Calendar, Car, MapPin, Battery, Receipt, Wallet, Zap, ArrowRight } from 'lucide-react';
import MagicBentoCard from '../../components/ui/MagicBentoCard';
import EmptyState from '../../components/ui/EmptyState';

interface NearbyStation { id: string; name: string; address: string; latitude: string; longitude: string; distance_km: number; }
interface Booking { id: string; order_id: string; transaction_id: string; ticket_id: string; amount: number; status: string; created_at: string; station_id?: string; }
interface LastBookedStation { station_id: string; station_name: string; }

const UserDashboard = () => {
  const navigate = useNavigate();
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [loadingNearbyStations, setLoadingNearbyStations] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<Booking[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [lastStation, setLastStation] = useState<LastBookedStation | null>(null);

  useEffect(() => {
    const fetchNearbyStations = async () => {
      try {
        let lat = 17.48; let lng = 78.52;
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
              () => resolve(),
              { timeout: 3000 }
            );
          });
        }
        const res = await stationAPI.getNearbyStations(lat, lng);
        setNearbyStations(res.data);
      } catch (error) {
        setNearbyStations([]);
      } finally {
        setLoadingNearbyStations(false);
      }
    };
    fetchNearbyStations();
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await carAPI.getCars(); setVehicles(res.data); } catch {}
      try { const resB = await bookingAPI.getMyBookingHistory(); setRecentTx(resB.data.slice(0, 2)); 
        // Find last booked station
        const allBookings = resB.data || [];
        if (allBookings.length > 0) {
          const lastB = allBookings[0]; // already sorted desc
          if (lastB.station_id) {
            try {
              const stRes = await stationAPI.getStationById(lastB.station_id);
              setLastStation({ station_id: lastB.station_id, station_name: stRes.data.name || 'Station' });
            } catch {
              setLastStation({ station_id: lastB.station_id, station_name: 'Previous Station' });
            }
          }
        }
      } catch {}
      try { const resW = await walletAPI.getBalance(); setWalletBalance(resW.data.balance); } catch {}
    })();
  }, []);

  const stats = { activeBookings: 0, totalCharges: 0, savedStations: 0 };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Quick Rebook Bar */}
      {lastStation && (
        <MagicBentoCard className="!border-primary/20" enableParticles enableSpotlight>
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your previous station</p>
                <p className="font-semibold text-lg">{lastStation.station_name}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!lastStation?.station_id) return;
                navigate(`/booking/${lastStation.station_id}/slots`);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow"
            >
              Quick Book <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </MagicBentoCard>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MagicBentoCard className="cursor-pointer" enableParticles={false} enableSpotlight>
          <div className="p-6" onClick={() => navigate('/dashboard/wallet')}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-1">EV Points</p>
            <p className="font-display font-bold text-2xl text-foreground">{walletBalance.toFixed(1)} pts</p>
          </div>
        </MagicBentoCard>

        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                <Battery className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-1">Total Charges</p>
            <p className="font-display font-bold text-2xl text-foreground">{stats.totalCharges}</p>
          </div>
        </MagicBentoCard>

        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                <Car className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-1">My Vehicles</p>
            <p className="font-display font-bold text-2xl text-foreground">{vehicles.length}</p>
          </div>
        </MagicBentoCard>

        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-1">Saved Stations</p>
            <p className="font-display font-bold text-2xl text-foreground">{stats.savedStations}</p>
          </div>
        </MagicBentoCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-lg text-foreground">My Vehicles</h2></div>
            {vehicles.length === 0 ? (
              <EmptyState icon={Car} title="No vehicles added" description="Add vehicles from the My Vehicles page." />
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center"><Car className="w-6 h-6 text-primary" /></div>
                    <div className="flex-1 min-w-0"><p className="font-medium text-foreground">{v.brand} {v.model}</p><p className="mt-1 text-sm font-mono tracking-wider text-muted-foreground">{v.car_number}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MagicBentoCard>

        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <h2 className="font-display font-semibold text-lg text-foreground mb-6">Nearby Stations</h2>
            {loadingNearbyStations ? (
              <p className="text-muted-foreground">Finding nearby stations...</p>
            ) : nearbyStations.length === 0 ? (
              <p className="text-muted-foreground">No stations found nearby.</p>
            ) : (
              <div className="space-y-3">
                {nearbyStations.map((station) => (
                  <div key={station.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div><p className="font-medium text-foreground">{station.name}</p><p className="text-sm text-muted-foreground">{station.address}</p></div>
                    <div className="text-sm font-medium text-primary">{station.distance_km} km</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MagicBentoCard>

        <MagicBentoCard className="lg:col-span-2" enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4"><Receipt className="w-5 h-5 text-primary" /><h3 className="font-display font-semibold text-lg text-foreground">Recent Transactions</h3></div>
            {recentTx.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent transactions.</p>
            ) : (
              <div className="space-y-2">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"><span className="font-mono">{tx.order_id}</span> • <span className="font-mono">{tx.transaction_id}</span></p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-sm font-medium">₹{tx.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MagicBentoCard>
      </div>
    </div>
  );
};

export default UserDashboard;
