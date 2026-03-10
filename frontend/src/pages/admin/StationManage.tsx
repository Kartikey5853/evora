import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2, Zap, ArrowLeft, ShieldAlert } from "lucide-react";
import { stationAPI, chargerAPI, slotAPI } from "@/lib/api";
import MagicBentoCard from "@/components/ui/MagicBentoCard";

const CHARGER_TYPES = ["CCS2", "Type2", "GB/T", "Portable"];

const toYyyyMmDd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const formatHHMM = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const StationManage = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState<any>(null);
  const [chargers, setChargers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCharger, setNewCharger] = useState({
    charger_type: "CCS2",
    power_kw: 22,
    price_per_hour: 100,
    name: "Charger",
    default_price_30min: 50,
  });
  const [loading, setLoading] = useState(true);

  // slot management
  const dateOptions = useMemo(() => {
    const base = new Date();
    return [toYyyyMmDd(base), toYyyyMmDd(addDays(base, 1)), toYyyyMmDd(addDays(base, 2))];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => toYyyyMmDd(new Date()));
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [windows, setWindows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Price editing state
  const [editingPriceWindow, setEditingPriceWindow] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>("");

  const load = async () => {
    if (!stationId) return;
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        stationAPI.getStationById(stationId),
        stationAPI.getChargersWithSlots(stationId),
      ]);
      setStation(s.data);
      setChargers(c.data);
    } finally {
      setLoading(false);
    }
  };

  const ensureGenerated = async (chargerId: string) => {
    await slotAPI.generate3Days(chargerId, { open_time: "06:00", close_time: "22:00" });
  };

  const loadWindows = async (chargerId: string, date: string) => {
    setBusy(`loadwin-${chargerId}-${date}`);
    try {
      const res = await slotAPI.getWindows(chargerId, date);
      setWindows(res.data || []);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    load();
  }, [stationId]);

  useEffect(() => {
    const run = async () => {
      if (chargers.length === 0) return;
      const cid = selectedChargerId ?? chargers[0].id;
      if (!selectedChargerId) setSelectedChargerId(cid);
      await ensureGenerated(cid);
      await loadWindows(cid, selectedDate);
    };
    run();
  }, [chargers]);

  useEffect(() => {
    const run = async () => {
      if (!selectedChargerId) return;
      await ensureGenerated(selectedChargerId);
      await loadWindows(selectedChargerId, selectedDate);
    };
    run();
  }, [selectedChargerId, selectedDate]);

  const addCharger = async () => {
    if (!stationId) return;
    setBusy("add-charger");
    try {
      const res = await chargerAPI.addCharger(stationId, {
        charger_type: newCharger.charger_type,
        power_kw: newCharger.power_kw,
        price_per_hour: newCharger.price_per_hour,
        name: newCharger.name,
        default_price_30min: newCharger.default_price_30min,
      } as any);

      const createdId = res?.data?.id;
      await load();
      if (createdId) {
        setSelectedChargerId(createdId);
        await ensureGenerated(createdId);
        await loadWindows(createdId, selectedDate);
      }

      setShowAdd(false);
      setNewCharger({ charger_type: "CCS2", power_kw: 22, price_per_hour: 100, name: "Charger", default_price_30min: 50 });
    } finally {
      setBusy(null);
    }
  };

  // Helper: get micro-slots in a window range
  const getMicroSlotsInWindow = async (window: any) => {
    if (!selectedChargerId) return [];
    const microRes = await slotAPI.getMicroSlotsByCharger(selectedChargerId, selectedDate);
    const micros = microRes.data || [];
    const start = new Date(window.start).getTime();
    const end = new Date(window.end).getTime();
    return micros.filter((s: any) => {
      const st = new Date(s.start_time).getTime();
      const en = new Date(s.end_time).getTime();
      return st >= start && en <= end;
    });
  };

  // Toggle window on/off
  const setWindowEnabled = async (window: any, enabled: boolean) => {
    if (!selectedChargerId) return;

    const now = new Date();
    const isToday = selectedDate === toYyyyMmDd(now);
    const winEnd = new Date(window.end);
    const expired = isToday && winEnd <= now;
    if (expired && enabled) return;

    setBusy(`win-${window.start}`);
    try {
      const inWindow = await getMicroSlotsInWindow(window);
      const status = enabled ? "AVAILABLE" : "DISABLED";
      for (const s of inWindow) {
        await slotAPI.patchSlot(s.id, { status });
      }
      await loadWindows(selectedChargerId, selectedDate);
    } finally {
      setBusy(null);
    }
  };

  // Toggle emergency flag on a window's micro-slots
  const toggleEmergency = async (window: any, makeEmergency: boolean) => {
    if (!selectedChargerId) return;
    setBusy(`em-${window.start}`);
    try {
      const inWindow = await getMicroSlotsInWindow(window);
      for (const s of inWindow) {
        await slotAPI.patchSlot(s.id, { is_emergency_slot: makeEmergency });
      }
      await loadWindows(selectedChargerId, selectedDate);
    } finally {
      setBusy(null);
    }
  };

  // Set price override on a window's micro-slots
  const setWindowPrice = async (window: any, price: number) => {
    if (!selectedChargerId) return;
    setBusy(`price-${window.start}`);
    try {
      const inWindow = await getMicroSlotsInWindow(window);
      for (const s of inWindow) {
        await slotAPI.patchSlot(s.id, { price_override: price });
      }
      await loadWindows(selectedChargerId, selectedDate);
      setEditingPriceWindow(null);
      setPriceInput("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manage Station</h1>
            <p className="text-sm text-muted-foreground">Station ID: {stationId}</p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="inline w-4 h-4 mr-1" /> Back
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !station ? (
          <p className="text-sm text-muted-foreground">Not found</p>
        ) : (
          <>            <MagicBentoCard enableSpotlight className="p-5 space-y-4">
              <p className="font-medium">{station.name}</p>
              <p className="text-sm text-muted-foreground">{station.address}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input-clean" value={station.name} onChange={e => setStation({ ...station, name: e.target.value })} placeholder="Name" />
                <input className="input-clean" value={station.address} onChange={e => setStation({ ...station, address: e.target.value })} placeholder="Address" />
                <input className="input-clean" value={station.latitude} onChange={e => setStation({ ...station, latitude: e.target.value })} placeholder="Latitude" />
                <input className="input-clean" value={station.longitude} onChange={e => setStation({ ...station, longitude: e.target.value })} placeholder="Longitude" />
              </div>
              <div className="flex justify-end">
                <button className="btn-primary" onClick={async () => { await stationAPI.updateStation(stationId!, station); await load(); }}>Save Changes</button>
              </div>
            </MagicBentoCard>

            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Chargers</h2>
              <button className="btn-secondary" onClick={() => setShowAdd(v => !v)}>
                {showAdd ? 'Cancel' : 'Add Charger'}
              </button>
            </div>

            {showAdd && (
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <input className="input" placeholder="Charger Name" value={newCharger.name} onChange={e => setNewCharger(c => ({ ...c, name: e.target.value }))} />
                <select className="input" value={newCharger.charger_type} onChange={e => setNewCharger(c => ({ ...c, charger_type: e.target.value }))}>
                  {CHARGER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input" type="number" placeholder="Power (kW)" value={newCharger.power_kw} onChange={e => setNewCharger(c => ({ ...c, power_kw: Number(e.target.value) }))} />
                <input className="input" type="number" placeholder="Default price (30 min)" value={newCharger.default_price_30min} onChange={e => setNewCharger(c => ({ ...c, default_price_30min: Number(e.target.value) }))} />
                <button className="btn-primary w-full" disabled={busy === "add-charger"} onClick={addCharger}>Create Charger</button>
              </div>
            )}            {/* ── Slot Management ─────────────────────────────────── */}
            <MagicBentoCard enableSpotlight className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold">Slot Windows (30 min)</p>
                  <p className="text-sm text-muted-foreground">
                    Toggle windows on/off, set price, and mark as emergency.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Quick picks: {dateOptions.join(', ')}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Charger</label>
                    <select className="input" value={selectedChargerId ?? ""} onChange={e => setSelectedChargerId(e.target.value)}>
                      {chargers.map(c => (
                        <option key={c.id} value={c.id}>{c.name || c.charger_type}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn-secondary"
                    disabled={!selectedChargerId || busy === `loadwin-${selectedChargerId}-${selectedDate}`}
                    onClick={() => selectedChargerId && loadWindows(selectedChargerId, selectedDate)}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-600" />
                  <span>Emergency Slot</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-white border" />
                  <span>Disabled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-600" />
                  <span>Booked</span>
                </div>
              </div>

              {!selectedChargerId ? (
                <p className="text-sm text-muted-foreground">Create/select a charger first.</p>
              ) : windows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No windows for this date. Slots will be generated automatically.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {windows.map((w: any) => {
                    const now = new Date();
                    const isToday = selectedDate === toYyyyMmDd(now);
                    const winEnd = new Date(w.end);
                    const expired = isToday && winEnd <= now;
                    const enabled = w.status === "AVAILABLE" || w.status === "PARTIAL";
                    const booked = w.status === "BOOKED";
                    const isEmergency = w.is_emergency_slot;
                    const isEditingPrice = editingPriceWindow === w.start;                    // Determine card color
                    let cardClass = "bg-card border text-muted-foreground";
                    if (expired) {
                      cardClass = "bg-muted border border-border text-muted-foreground opacity-50";
                    } else if (booked) {
                      cardClass = "bg-blue-50 border-blue-300 text-blue-800";
                    } else if (isEmergency && enabled) {
                      cardClass = "bg-red-50 border-2 border-red-400 text-red-800";
                    } else if (enabled) {
                      cardClass = "bg-accent border-primary/30 text-primary";
                    }

                    return (
                      <div
                        key={w.start}
                        className={`rounded-xl p-3 space-y-2 transition ${cardClass}`}
                      >
                        {/* Time label */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {formatHHMM(w.start)} – {formatHHMM(w.end)}
                          </span>
                          {isEmergency && (
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                          )}
                        </div>                        {/* Status */}
                        <div className="text-xs">
                          {expired ? "Expired" : booked ? "Booked" : enabled ? "Active" : "Disabled"}
                          {w.free_micro_slots !== undefined && w.free_micro_slots < 3 && !booked && enabled && (
                            <span className="ml-1">({w.free_micro_slots}/3 free)</span>
                          )}
                        </div>

                        {/* Current price */}
                        {w.price != null && (
                          <div className="text-xs font-medium text-amber-700">
                            ₹{Number(w.price).toFixed(2)} / 30 min
                          </div>
                        )}

                        {/* Action buttons */}
                        {!expired && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {/* On/Off toggle */}
                            {!booked && (
                              <button
                                disabled={busy === `win-${w.start}`}
                                onClick={() => setWindowEnabled(w, !enabled)}                                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition ${
                                  enabled
                                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                }`}
                              >
                                {busy === `win-${w.start}` ? "…" : enabled ? "Disable" : "Enable"}
                              </button>
                            )}

                            {/* Emergency toggle — only when slot is enabled and not booked */}
                            {enabled && !booked && (
                              <button
                                disabled={busy === `em-${w.start}`}
                                onClick={() => toggleEmergency(w, !isEmergency)}
                                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                                  isEmergency
                                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                    : "bg-red-600 text-white hover:bg-red-700"
                                }`}
                              >
                                <ShieldAlert className="w-3 h-3" />
                                {busy === `em-${w.start}` ? "…" : isEmergency ? "Remove 🚨" : "Mark 🚨"}
                              </button>
                            )}

                            {/* Price button */}
                            {enabled && !booked && (
                              <button
                                onClick={() => {
                                  if (isEditingPrice) {
                                    setEditingPriceWindow(null);
                                  } else {
                                    setEditingPriceWindow(w.start);
                                    setPriceInput("");
                                  }
                                }}
                                className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition"
                              >
                                ₹ Price
                              </button>
                            )}
                          </div>
                        )}

                        {/* Price editing inline */}
                        {isEditingPrice && (
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="number"
                              placeholder="₹ per 30m"
                              className="flex-1 px-2 py-1 border rounded text-xs"
                              value={priceInput}
                              onChange={e => setPriceInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" && priceInput) {
                                  setWindowPrice(w, Number(priceInput));
                                }
                              }}
                            />
                            <button
                              disabled={!priceInput || busy === `price-${w.start}`}
                              onClick={() => priceInput && setWindowPrice(w, Number(priceInput))}
                              className="text-[11px] px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {busy === `price-${w.start}` ? "…" : "Set"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>              )}
            </MagicBentoCard>

            {/* ── Charger list ────────────────────────────────────── */}
            <div className="space-y-4">              {chargers.map((charger) => (
                <MagicBentoCard enableSpotlight key={charger.id} className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{charger.name || charger.charger_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {(charger.power_output_kw ?? charger.power_kw) || "—"} kW • 30m: ₹{charger.default_price_30min ?? "—"}
                        </p>
                      </div>
                    </div>
                    <button className="text-red-600 hover:text-red-700" onClick={async () => { if (!confirm('Delete this charger?')) return; await chargerAPI.deleteCharger(charger.id); await load(); }}>
                      <Trash2 className="w-4 h-4" />
                    </button>                  </div>
                </MagicBentoCard>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default StationManage;
