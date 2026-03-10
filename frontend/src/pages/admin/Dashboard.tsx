import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Zap, 
  TrendingUp,
  Settings,
  Clock,
  Battery,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MagicBentoCard from '../../components/ui/MagicBentoCard';
import AreaChart from '../../components/ui/AreaChart';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AddChargerModal from '../../components/modals/AddChargerModal';
import AddSlotModal from '../../components/modals/AddSlotModal';
import { stationAPI, slotAPI, adminAnalyticsAPI } from '../../lib/api';

interface Station {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  supported_charger_types?: string[];
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChargerModal, setShowAddChargerModal] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [earnings, setEarnings] = useState<{ daily: { date: string; earnings: number }[]; total: number; wallet_balance: number }>({ daily: [], total: 0, wallet_balance: 0 });
  const [peakHours, setPeakHours] = useState<{ hour: number; bookings: number }[]>([]);
  const [graphMode, setGraphMode] = useState<'earnings' | 'peak'>('earnings');

  const stats = {
    totalStations: stations.length,
    availableSlots: Math.floor(Object.values(availableCounts).reduce((a, b) => a + b, 0) / 3),
  };

  useEffect(() => {
    fetchStations();
    (async () => {
      try {
        const [eRes, pRes] = await Promise.all([adminAnalyticsAPI.getEarnings(30), adminAnalyticsAPI.getPeakHours(30)]);
        setEarnings(eRes.data);
        setPeakHours(pRes.data.hours || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const run = async () => {
      const entries = await Promise.all(
        stations.map(async (s) => {
          try {
            const res = await slotAPI.getAvailableCount(s.id);
            return [s.id, res.data.available_slots as number] as const;
          } catch {
            return [s.id, 0] as const;
          }
        })
      );
      setAvailableCounts(Object.fromEntries(entries));
    };
    if (stations.length) run();
  }, [stations]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const response = await stationAPI.getStations();
      setStations(response.data);
    } catch (error) {
      console.error('Failed to fetch stations:', error);
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharger = (stationId: string) => {
    setSelectedStationId(stationId);
    setShowAddChargerModal(true);
  };

  const handleAddSlot = (stationId: string) => {
    setSelectedStationId(stationId);
    setShowAddSlotModal(true);
  };

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your charging stations and monitor performance</p>
          </div>
        </div>

        {/* ── Big toggleable graph (sigmoid emphasis — shown FIRST) ── */}
        <MagicBentoCard enableParticles enableSpotlight className="!border-primary/15">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {graphMode === 'earnings' ? (
                  <TrendingUp className="w-5 h-5 text-primary" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-primary" />
                )}
                <h2 className="font-display font-semibold text-lg">
                  {graphMode === 'earnings' ? 'Earnings (Last 30 Days)' : 'Peak Hours (Last 30 Days)'}
                </h2>
              </div>
              <button
                onClick={() => setGraphMode(graphMode === 'earnings' ? 'peak' : 'earnings')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium text-muted-foreground transition"
              >
                {graphMode === 'earnings' ? (
                  <><BarChart3 className="w-4 h-4" /> Show Peak Hours</>
                ) : (
                  <><TrendingUp className="w-4 h-4" /> Show Earnings</>
                )}
              </button>
            </div>

            {graphMode === 'earnings' ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">Host share: 80% of each booking</p>
                {earnings.daily.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No earnings data yet</p>
                ) : (
                  <AreaChart
                    data={earnings.daily.map(d => d.earnings)}
                    labels={earnings.daily.map(d => d.date.slice(5))}
                    tooltipPrefix="₹"
                    height={256}
                  />
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">Booking count by hour of day</p>
                {peakHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No booking data yet</p>
                ) : (
                  <AreaChart
                    data={peakHours.map(h => h.bookings)}
                    labels={peakHours.map(h => `${h.hour}:00`)}
                    tooltipSuffix=" bookings"
                    height={256}
                    labelInterval={4}
                  />
                )}
              </>
            )}
          </div>
        </MagicBentoCard>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MagicBentoCard enableParticles={false} enableSpotlight>
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Total Stations</p>
              <p className="font-display font-bold text-2xl">{stats.totalStations}</p>
            </div>
          </MagicBentoCard>

          <MagicBentoCard enableParticles={false} enableSpotlight>
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Today's 30-min Slots</p>
              <p className="font-display font-bold text-2xl">{stats.availableSlots}</p>
            </div>
          </MagicBentoCard>

          <MagicBentoCard enableParticles={false} enableSpotlight className="cursor-pointer" style={{}} >
            <div className="p-6" onClick={() => navigate('/admin/wallet')}>
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Host Wallet</p>
              <p className="font-display font-bold text-2xl">₹{earnings.wallet_balance.toFixed(0)}</p>
            </div>
          </MagicBentoCard>

          <MagicBentoCard enableParticles={false} enableSpotlight>
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">30-Day Earnings (80%)</p>
              <p className="font-display font-bold text-2xl">₹{earnings.total.toFixed(0)}</p>
            </div>
          </MagicBentoCard>
        </div>

        {/* Station Management */}
        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-xl text-foreground">Station Management</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : stations.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">No stations available.</div>
            ) : (
              <div className="space-y-4">
                {stations.map((station) => (
                  <div key={station.id} className="p-5 rounded-xl bg-muted/30 border border-border hover:shadow-soft transition-all duration-200">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
                          <MapPin className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-lg">{station.name}</h3>
                          <p className="text-sm text-muted-foreground">{station.address}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Battery className="w-4 h-4 text-primary" />
                              {(station.supported_charger_types?.length ?? 0)} types
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4 text-primary" />
                              {availableCounts[station.id] ?? 0} available slots
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-16 lg:pl-0">
                        <button onClick={() => handleAddCharger(station.id)} className="btn-secondary !py-2 !px-4 text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Add Charger
                        </button>
                        <button onClick={() => handleAddSlot(station.id)} className="btn-secondary !py-2 !px-4 text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Add Slot
                        </button>
                        <button className="btn-secondary !py-2 !px-4 text-sm flex items-center gap-2" onClick={() => navigate(`/admin/stations/${station.id}/manage`)}>
                          <Settings className="w-4 h-4" /> Manage
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MagicBentoCard>
      </div>

      <AddChargerModal isOpen={showAddChargerModal} onClose={() => setShowAddChargerModal(false)} stationId={selectedStationId} onSuccess={fetchStations} />
      <AddSlotModal isOpen={showAddSlotModal} onClose={() => setShowAddSlotModal(false)} stationId={selectedStationId} onSuccess={fetchStations} />
    </>
  );
};

export default AdminDashboard;