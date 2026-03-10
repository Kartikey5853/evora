import { useState, useEffect } from 'react';
import { Car, CheckCircle, Trash2, ShieldAlert, Clock, XCircle as XCircleIcon, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EmptyState from '../../components/ui/EmptyState';
import { carAPI } from '../../lib/api';
import MagicBentoCard from '../../components/ui/MagicBentoCard';

/* ── Types ─────────────────────────────────────────────────────── */
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  chargerType: string;
  carNumber: string;
  isEmergency: boolean;
  emergencyType?: string;
  emergencyProofUrl?: string;
  emergencyStatus?: string;
}

/* ── Vehicle Catalog ───────────────────────────────────────────── */
const CAR_CATALOG: Record<string, Record<string, string>> = {
  Tata: { 'Nexon EV': 'CCS2', 'Tiago EV': 'CCS2' },
  MG: { 'ZS EV': 'CCS2' },
  Tesla: { 'Model 3': 'Type 2', 'Model Y': 'Type 2' },
  Hyundai: { 'Kona Electric': 'CCS2' },
};

const CHARGER_TYPES = ['CCS2', 'Type 2', 'CHAdeMO', 'GB/T'];

type VehicleMode = 'regular' | 'emergency';

const MyVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  /* ── Unified form state ──────────────────────────────────────── */
  const [mode, setMode] = useState<VehicleMode>('regular');

  // Common fields
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [chargerType, setChargerType] = useState('');

  // Emergency-specific
  const [emType, setEmType] = useState<'POLICE' | 'AMBULANCE' | 'FIRE'>('POLICE');
  const [emProofUrl, setEmProofUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);

  /* ── Fetch vehicles on mount ─────────────────────────────────── */
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await carAPI.getCars();
        setVehicles(
          res.data.map((c: any) => ({
            id: c.id,
            brand: c.brand,
            model: c.model,
            chargerType: c.charger_type,
            carNumber: c.car_number,
            isEmergency: c.is_emergency || false,
            emergencyType: c.emergency_type,
            emergencyProofUrl: c.emergency_proof_url,
            emergencyStatus: c.emergency_status,
          }))
        );
      } catch (err) {
        console.error('Failed to load vehicles', err);
      }
    };
    fetchVehicles();
  }, []);

  /* ── Derived values ──────────────────────────────────────────── */
  const isRegular = mode === 'regular';
  const availableModels = isRegular && brand ? Object.keys(CAR_CATALOG[brand] || {}) : [];
  const autoChargerType = isRegular && brand && model ? CAR_CATALOG[brand]?.[model] || '' : '';

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleDeleteVehicle = async (id: string) => {
    try {
      await carAPI.deleteCar(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Failed to delete vehicle', err);
    }
  };

  const resetForm = () => {
    setBrand('');
    setModel('');
    setCarNumber('');
    setChargerType('');
    setEmType('POLICE');
    setEmProofUrl('');
  };

  const flashSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleSubmit = async () => {
    if (!brand || !model || !carNumber) return;
    setSubmitting(true);

    try {
      if (isRegular) {
        const res = await carAPI.addCar({
          brand,
          model,
          car_number: carNumber,
          charger_type: autoChargerType,
        });
        setVehicles((prev) => [
          ...prev,
          {
            id: res.data.id,
            brand: res.data.brand,
            model: res.data.model,
            chargerType: res.data.charger_type,
            carNumber: res.data.car_number,
            isEmergency: false,
          },
        ]);
      } else {
        if (!emProofUrl || !chargerType) return;
        const res = await carAPI.addEmergencyCar({
          brand,
          model,
          car_number: carNumber,
          charger_type: chargerType,
          emergency_type: emType,
          emergency_proof_url: emProofUrl,
        });
        setVehicles((prev) => [
          ...prev,
          {
            id: res.data.id,
            brand: res.data.brand,
            model: res.data.model,
            chargerType: res.data.charger_type,
            carNumber: res.data.car_number,
            isEmergency: true,
            emergencyType: res.data.emergency_type,
            emergencyProofUrl: res.data.emergency_proof_url,
            emergencyStatus: res.data.emergency_status,
          },
        ]);
      }
      resetForm();
      flashSuccess();
    } catch (err) {
      console.error('Failed to add vehicle', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = isRegular
    ? !!(brand && model && carNumber)
    : !!(brand && model && carNumber && chargerType && emProofUrl);

  return (
    <DashboardLayout userType="user">
      <div className="w-full space-y-8">

        {/* ── My Vehicles list ───────────────────────────────────── */}        <MagicBentoCard enableSpotlight className="p-6">
          <h1 className="text-xl font-semibold text-foreground mb-4">My Vehicles</h1>

          {vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No vehicles added"
              description="Add your EV below to start booking charging slots"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className={`relative p-4 rounded-xl transition ${
                    v.isEmergency
                      ? 'bg-red-50/60 border border-red-200 hover:bg-red-50'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {/* Delete */}
                  <div className="absolute inset-y-0 right-4 flex items-center">
                    <button
                      onClick={() => handleDeleteVehicle(v.id)}
                      className="text-muted-foreground hover:text-destructive transition"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="font-medium text-foreground">{v.brand} {v.model}</p>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">{v.carNumber}</p>

                  <div className="flex flex-wrap gap-2 mt-3">                    <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-accent text-primary">
                      {v.chargerType}
                    </span>

                    {v.isEmergency && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">
                          <ShieldAlert className="w-3 h-3" />
                          {v.emergencyType}
                        </span>

                        {v.emergencyStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" /> Pending Approval
                          </span>
                        )}
                        {v.emergencyStatus === 'APPROVED' && (                        <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-accent text-primary">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                        )}
                        {v.emergencyStatus === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">
                            <XCircleIcon className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}            </div>
          )}
        </MagicBentoCard>

        {/* ── Add Vehicle (unified form) ─────────────────────────── */}
        <MagicBentoCard enableSpotlight className={`p-6 space-y-5 border-2 transition ${
          isRegular ? '!border-primary/20' : '!border-red-200'
        }`}>
          <h2 className="text-lg font-semibold text-foreground">Add a New Vehicle</h2>

          {/* ── Mode selector ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setMode('regular'); resetForm(); }}              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition ${
                isRegular
                  ? 'border-primary bg-accent text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <Car className="w-4 h-4" />
              Regular Vehicle
            </button>
            <button              onClick={() => { setMode('emergency'); resetForm(); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition ${
                !isRegular
                  ? 'border-red-500 bg-red-50 text-red-800'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Emergency Vehicle
            </button>
          </div>

          {/* ── Emergency info banner ─────────────────────────────── */}
          {!isRegular && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Emergency vehicles (police, ambulance, fire truck) can override bookings on emergency-designated slots.
                Registration requires <strong>superadmin approval</strong>.
              </span>
            </div>
          )}

          {/* ── Emergency type selector ───────────────────────────── */}
          {!isRegular && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'POLICE' as const, label: '🚔 Police' },
                { val: 'AMBULANCE' as const, label: '🚑 Ambulance' },
                { val: 'FIRE' as const, label: '🚒 Fire Truck' },
              ]).map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setEmType(val)}
                  className={`py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                    emType === val
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── Common fields ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isRegular ? (
              <>
                {/* Regular: brand from catalog */}
                <select
                  value={brand}
                  onChange={(e) => { setBrand(e.target.value); setModel(''); }}
                  className="p-3 rounded-lg border"
                >
                  <option value="">Select Brand</option>
                  {Object.keys(CAR_CATALOG).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                {/* Regular: model from catalog */}
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={!brand}
                  className="p-3 rounded-lg border disabled:opacity-50"
                >
                  <option value="">Select Model</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* Charger type auto-filled */}
                <input
                  type="text"
                  value={autoChargerType}
                  disabled
                  placeholder="Charger Type"
                  className="p-3 rounded-lg border bg-muted"
                />
              </>
            ) : (
              <>
                {/* Emergency: free-text brand */}
                <input
                  type="text"
                  placeholder="Vehicle Brand (e.g. Tata)"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="p-3 rounded-lg border"
                />

                {/* Emergency: free-text model */}
                <input
                  type="text"
                  placeholder="Vehicle Model (e.g. Nexon EV)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="p-3 rounded-lg border"
                />

                {/* Charger type dropdown */}
                <select
                  value={chargerType}
                  onChange={(e) => setChargerType(e.target.value)}
                  className="p-3 rounded-lg border"
                >
                  <option value="">Select Charger Type</option>
                  {CHARGER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </>
            )}

            {/* Car number (both modes) */}
            <input
              type="text"
              placeholder="Vehicle Number (e.g. MH12AB1234)"
              value={carNumber}
              onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
              className="p-3 rounded-lg border"
            />

            {/* Proof URL (emergency only) */}
            {!isRegular && (
              <input
                type="text"
                placeholder="Proof Document URL (certificate/license)"
                value={emProofUrl}
                onChange={(e) => setEmProofUrl(e.target.value)}
                className="p-3 rounded-lg border md:col-span-2"
              />
            )}
          </div>

          {/* ── Submit ─────────────────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}            className={`w-full py-3 rounded-xl text-white font-medium disabled:opacity-50 transition ${
              isRegular
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting
              ? 'Saving…'
              : isRegular
              ? 'Save Vehicle'
              : 'Submit for Approval'}          </button>
        </MagicBentoCard>
      </div>

      {/* ── Success Toast ──────────────────────────────────────── */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <CheckCircle className="w-5 h-5" />
          <span>Vehicle saved successfully</span>
        </div>
      )}
    </DashboardLayout>
  );
};

export default MyVehicles;
