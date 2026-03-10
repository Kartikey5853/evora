import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, carAPI } from '@/lib/api';

const CAR_CATALOG: Record<string, { model: string; charger_type: string }[]> = {
  Tata: [
    { model: 'Nexon EV', charger_type: 'CCS' },
    { model: 'Tiago EV', charger_type: 'CCS' },
  ],
  MG: [{ model: 'ZS EV', charger_type: 'CCS' }],
  Tesla: [
    { model: 'Model 3', charger_type: 'Type2' },
    { model: 'Model Y', charger_type: 'Type2' },
  ],
};

const SetupProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [brand, setBrand] = useState(Object.keys(CAR_CATALOG)[0]);
  const [model, setModel] = useState(CAR_CATALOG[Object.keys(CAR_CATALOG)[0]][0].model);
  const [carNumber, setCarNumber] = useState('');
  const [chargerType, setChargerType] = useState(CAR_CATALOG[Object.keys(CAR_CATALOG)[0]][0].charger_type);

  useEffect(() => {
    (async () => {
      try {
        const resMe = await authAPI.me();
        if (resMe.data?.is_profile_complete) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // NOTE: backend upload endpoint not implemented yet.
  };

  const handleFinish = async () => {
    setErrorMsg(null);
    if (!brand.trim() || !model.trim() || !carNumber.trim()) {
      setErrorMsg('Please add your vehicle details.');
      return;
    }

    setSaving(true);
    try {
      await carAPI.addCar({
        brand: brand.trim(),
        model: model.trim(),
        car_number: carNumber.trim().toUpperCase(),
        charger_type: chargerType,
      });

      // Mark profile as complete so this screen doesn't show again
      await authAPI.updateMe({ is_profile_complete: true });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground">Loading setup...</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 lg:p-8">
      <div className="card-elevated p-6">
        <h1 className="text-xl font-semibold">Complete your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a profile picture and add a vehicle.</p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <div className="card-elevated p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Profile picture</label>
          <input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
          {previewUrl && (
            <img src={previewUrl} alt="preview" className="mt-3 h-24 w-24 rounded-xl object-cover border border-border" />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Backend upload not implemented yet; this preview is local.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Brand</label>
            <select
              className="input-clean"
              value={brand}
              onChange={(e) => {
                const b = e.target.value;
                setBrand(b);
                const first = CAR_CATALOG[b]?.[0];
                if (first) {
                  setModel(first.model);
                  setChargerType(first.charger_type);
                }
              }}
            >
              {Object.keys(CAR_CATALOG).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <select
              className="input-clean"
              value={model}
              onChange={(e) => {
                const m = e.target.value;
                setModel(m);
                const found = CAR_CATALOG[brand]?.find((x) => x.model === m);
                if (found) setChargerType(found.charger_type);
              }}
            >
              {CAR_CATALOG[brand]?.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Car number</label>
            <input className="input-clean" value={carNumber} onChange={(e) => setCarNumber(e.target.value)} placeholder="MH12AB1234" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Charger type</label>
            <input className="input-clean" value={chargerType} disabled />
          </div>
        </div>

        <button onClick={handleFinish} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Finish setup'}
        </button>
      </div>
    </div>
  );
};

export default SetupProfile;
