import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import {
  ArrowLeft,
  BellRing,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from "lucide-react"
import { stationAPI, slotAPI } from "@/lib/api"
import { carAPI } from "@/lib/api"

/* ─── types ─────────────────────────────────────────────── */
interface Charger {
  id: string
  charger_type: string
  name?: string
  power_kw?: string | number
  power_output_kw?: number
  default_price_30min?: number
}

interface SlotWindow {
  start: string
  end: string
  status: "AVAILABLE" | "PARTIAL" | "BOOKED" | "DISABLED"
  available_from?: string | null
  free_micro_slots: number
  recently_released?: boolean
  is_emergency_slot?: boolean
  price?: number | null
}

/* ─── helpers ───────────────────────────────────────────── */
const toYyyyMmDd = (d: Date) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const formatTime = (isoString: string) =>
  new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

const stationIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

/* ═══════════════════════════════════════════════════════════ */
const SlotSelectionPage = () => {
  const { stationId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as any
  const { station: stationFromState, vehicle: vehicleFromState } = state || {}

  const [station, setStation] = useState<any>(stationFromState || null)
  const [vehicle, setVehicle] = useState<any>(vehicleFromState || null)
  const [myVehicles, setMyVehicles] = useState<any[]>([])
  const [showPanel, setShowPanel] = useState(true)

  /* ── date slider (7 days) ──────────────────────────────── */
  const dateOptions = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i)
      return {
        value: toYyyyMmDd(d),
        day: d.getDate(),
        dayName: DAY_NAMES[d.getDay()],
        month: MONTH_NAMES[d.getMonth()],
        isToday: i === 0,
      }
    })
  }, [])

  const [selectedDate, setSelectedDate] = useState<string>(() => toYyyyMmDd(new Date()))
  const dateScrollRef = useRef<HTMLDivElement>(null)

  const scrollDates = (dir: "left" | "right") => {
    if (!dateScrollRef.current) return
    dateScrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })
  }

  /* ── chargers & windows ───────────────────────────────── */
  const [chargers, setChargers] = useState<Charger[]>([])
  const [loadingChargers, setLoadingChargers] = useState(true)
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null)
  const [windows, setWindows] = useState<SlotWindow[]>([])
  const [loadingWindows, setLoadingWindows] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [selectedWindowStarts, setSelectedWindowStarts] = useState<string[]>([])

  const [showReleasedBanner, setShowReleasedBanner] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenReleasedRef = useRef<Set<string>>(new Set())

  /* ── data fetching ─────────────────────────────────────── */
  useEffect(() => {
    const loadContext = async () => {
      try {
        if (!station && stationId) {
          const stRes = await stationAPI.getStationById(stationId)
          setStation(stRes.data)
        }
      } catch {}
      try {
        if (!vehicle) {
          const carRes = await carAPI.getCars()
          setMyVehicles(carRes.data || [])
        }
      } catch {}
    }
    loadContext()
  }, [stationId])

  useEffect(() => {
    if (!stationId) return
    const fetch = async () => {
      setLoadingChargers(true)
      try {
        const res = await stationAPI.getChargersWithSlots(stationId)
        const data: Charger[] = (res.data || []).map((c: any) => ({
          id: c.id, charger_type: c.charger_type, name: c.name,
          power_kw: c.power_kw, power_output_kw: c.power_output_kw,
          default_price_30min: c.default_price_30min,
        }))
        setChargers(data)
        if (!selectedChargerId && data.length > 0) setSelectedChargerId(data[0].id)
      } catch (e) { console.error(e) }
      finally { setLoadingChargers(false) }
    }
    fetch()
  }, [stationId])

  const fetchWindows = useCallback(async () => {
    if (!selectedChargerId) return
    try {
      const res = await slotAPI.getWindows(selectedChargerId, selectedDate)
      const incoming: SlotWindow[] = res.data || []
      setWindows(incoming)
      const newReleased = incoming.filter(
        w => w.recently_released && !seenReleasedRef.current.has(w.start)
      )
      if (newReleased.length > 0) {
        newReleased.forEach(w => seenReleasedRef.current.add(w.start))
        setShowReleasedBanner(true)
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = setTimeout(() => setShowReleasedBanner(false), 5000)
      }
    } catch (e) { console.error(e) }
  }, [selectedChargerId, selectedDate])

  useEffect(() => {
    if (!selectedChargerId) return
    let cancelled = false
    const doInitial = async () => {
      if (!initialLoadDone) setLoadingWindows(true)
      await fetchWindows()
      if (!cancelled) { setLoadingWindows(false); setInitialLoadDone(true) }
    }
    doInitial()
    const interval = setInterval(fetchWindows, 15_000)
    return () => { cancelled = true; clearInterval(interval); if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current) }
  }, [fetchWindows, selectedChargerId])

  useEffect(() => {
    setSelectedWindowStarts([])
    seenReleasedRef.current.clear()
    setShowReleasedBanner(false)
    setInitialLoadDone(false)
  }, [selectedChargerId, selectedDate])

  /* ── computed ──────────────────────────────────────────── */
  const sortedWindows = useMemo(() =>
    [...windows].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()), [windows])

  const selectedWindows = useMemo(() => {
    const set = new Set(selectedWindowStarts)
    return sortedWindows.filter(w => set.has(w.start))
  }, [sortedWindows, selectedWindowStarts])

  const selectedStart = selectedWindows.length ? selectedWindows[0].start : null
  const selectedEnd = selectedWindows.length ? selectedWindows[selectedWindows.length - 1].end : null
  const selectedCharger = chargers.find(c => c.id === selectedChargerId) || null
  const pricePer30 = selectedCharger?.default_price_30min ?? null
  const totalPrice = selectedWindows.reduce((sum, w) => sum + (w.price ?? pricePer30 ?? 0), 0)
  const durationHours = selectedStart && selectedEnd
    ? (new Date(selectedEnd).getTime() - new Date(selectedStart).getTime()) / 3600000 : 0

  const toggleWindow = (w: SlotWindow) => {
    const startMs = new Date(w.start).getTime()
    const isSelected = selectedWindowStarts.includes(w.start)
    if (isSelected) { setSelectedWindowStarts(prev => prev.filter(x => x !== w.start)); return }
    setSelectedWindowStarts(prev => {
      if (prev.length === 0) return [w.start]
      if (prev.length >= 4) return prev
      const selected = prev.map(s => new Date(s).getTime()).sort((a, b) => a - b)
      const thirty = 30 * 60 * 1000
      const isAdjacent = startMs === selected[0] - thirty || startMs === selected[selected.length - 1] + thirty
      if (!isAdjacent) return prev
      return [...prev, w.start].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    })
  }

  const selectionError = useMemo(() => {
    if (selectedWindowStarts.length === 0) return "Select one or more consecutive windows."
    if (selectedWindowStarts.length > 4) return "Max 2 hours (4 windows)."
    return null
  }, [selectedWindowStarts.length])

  const resolveFirstMicroSlotId = async (): Promise<string> => {
    if (!selectedChargerId || !selectedStart || !selectedEnd) throw new Error("Missing selection")
    const micros = await slotAPI.getMicroSlotsByCharger(selectedChargerId, selectedDate)
    const list = micros.data || []
    const startMs = new Date(selectedStart).getTime()
    const endMs = new Date(selectedEnd).getTime()
    const inWindow = list
      .filter((s: any) => new Date(s.start_time).getTime() >= startMs && new Date(s.end_time).getTime() <= endMs)
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    if (inWindow.length === 0) throw new Error("No micro-slots found for this selection")
    return inWindow[0].id
  }

  /* ── map center ────────────────────────────────────────── */
  const mapCenter: [number, number] = station
    ? [Number(station.latitude) || 17.48, Number(station.longitude) || 78.52]
    : [17.48, 78.52]

  /* ═══════════════════════════════════════════════════════ */
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* ── Glass Side Panel ──────────────────────────────── */}
      {showPanel && (
        <div className="w-full md:w-[40%] h-full flex flex-col bg-card/70 backdrop-blur-2xl backdrop-saturate-150 border-r border-border/30 shadow-2xl z-[1000] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h1 className="text-lg font-semibold">Select Charging Slot</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {station?.name || "Loading…"}
              </p>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Vehicle picker (when Quick Book without vehicle) */}
            {!vehicle && myVehicles.length > 0 && (
              <div className="p-4 border-b border-border/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Select Vehicle</p>
                <select
                  className="input-clean w-full"
                  value={vehicle?.id || ""}
                  onChange={(e) => {
                    const v = myVehicles.find((x: any) => x.id === e.target.value)
                    setVehicle(v || null)
                  }}
                >
                  <option value="" disabled>Select your vehicle</option>
                  {myVehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.car_number})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Date Slider ─────────────────────────────── */}
            <div className="p-4 border-b border-border/30">
              <p className="text-xs font-medium text-muted-foreground mb-3">Select Date</p>
              <div className="relative">
                <button
                  onClick={() => scrollDates("left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card/80 backdrop-blur border border-border/30 flex items-center justify-center hover:bg-muted transition shadow"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div
                  ref={dateScrollRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hide px-8 py-1 snap-x snap-mandatory"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {dateOptions.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => { setSelectedDate(d.value); setSelectedWindowStarts([]) }}
                      className={`flex-shrink-0 snap-center flex flex-col items-center min-w-[56px] py-2.5 px-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedDate === d.value
                          ? "border-primary bg-primary text-primary-foreground shadow-lg"
                          : "border-border/40 bg-card hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                        {d.dayName}
                      </span>
                      <span className="text-xl font-bold leading-tight mt-0.5">
                        {d.day}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {d.month}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => scrollDates("right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card/80 backdrop-blur border border-border/30 flex items-center justify-center hover:bg-muted transition shadow"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Chargers (stacked, one below the other) ── */}
            <div className="p-4 border-b border-border/30">
              <p className="text-xs font-medium text-muted-foreground mb-3">Select Charger</p>
              {loadingChargers ? (
                <p className="text-sm text-muted-foreground">Loading chargers…</p>
              ) : (
                <div className="space-y-2">
                  {chargers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedChargerId(c.id); setSelectedWindowStarts([]) }}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 ${
                        selectedChargerId === c.id
                          ? "border-primary bg-primary/10 shadow"
                          : "border-border/40 bg-card hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          selectedChargerId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.name || c.charger_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.charger_type}
                            {c.power_output_kw ? ` · ${c.power_output_kw}kW` : c.power_kw ? ` · ${c.power_kw}kW` : ""}
                            {c.default_price_30min ? ` · ₹${c.default_price_30min}/30min` : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Time Windows ─────────────────────────────── */}
            <div className="p-4">
              {loadingWindows ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading windows…</p>
              ) : !selectedChargerId ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Select a charger.</p>
              ) : windows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No windows available for this date.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-muted-foreground">Available Windows</p>
                  <div className="grid grid-cols-3 gap-2">
                    {sortedWindows.map(w => {
                      const now = new Date()
                      const isToday = selectedDate === toYyyyMmDd(now)
                      const expiredByTime = isToday && new Date(w.end) <= now
                      const selectable = w.status === "AVAILABLE" || w.status === "PARTIAL"
                      const disabled = expiredByTime || !selectable
                      const isSelected = selectedWindowStarts.includes(w.start)
                      const isReleased = w.recently_released
                      const isPartial = w.status === "PARTIAL"
                      let label = formatTime(w.start)
                      if (isPartial) label += ` (${w.free_micro_slots}/3)`
                      const windowPrice = w.price ?? pricePer30 ?? null

                      return (
                        <button
                          key={w.start}
                          disabled={disabled}
                          onClick={() => toggleWindow(w)}
                          className={`relative text-xs py-2.5 px-1 rounded-xl font-medium transition border-2 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-lg"
                              : disabled
                              ? "bg-muted text-muted-foreground border-transparent opacity-50"
                              : isReleased
                              ? "bg-accent text-accent-foreground border-primary/30 ring-1 ring-primary/20 hover:bg-accent/80"
                              : w.is_emergency_slot
                              ? "bg-red-50 text-red-700 border-red-300 ring-1 ring-red-200 hover:bg-red-100"
                              : "bg-card text-foreground border-border/40 hover:border-primary/40 hover:bg-muted/30"
                          }`}
                          title={[`${formatTime(w.start)} – ${formatTime(w.end)}`, w.status].join(" — ")}
                        >
                          <span>{label}</span>
                          {windowPrice != null && (
                            <span className="block text-[10px] opacity-75 mt-0.5">₹{windowPrice.toFixed(0)}</span>
                          )}
                          {w.is_emergency_slot && !isSelected && (
                            <span className="absolute -top-1 -left-1">
                              <ShieldAlert className="w-3 h-3 text-red-500" />
                            </span>
                          )}
                          {isReleased && !isSelected && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Select adjacent 30-min windows (max 2hrs). Auto-refreshes every 15s.
                  </p>

                  {sortedWindows.some(w => w.recently_released) && (
                    <div className="p-3 rounded-xl border border-primary/20 bg-accent/50">
                      <div className="flex items-center gap-2">
                        <BellRing className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-medium text-primary">Recently Released Slots</p>
                      </div>
                      <p className="text-[11px] text-primary/70 mt-1">
                        Freed after a no-show — first come, first served.
                      </p>
                    </div>
                  )}

                  {selectedWindowStarts.length > 0 && windows.some(w => selectedWindowStarts.includes(w.start) && w.is_emergency_slot) && (
                    <div className="p-3 rounded-xl border border-red-200 bg-red-50/50">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        <p className="text-xs font-medium text-red-800">Emergency Slot</p>
                      </div>
                      <p className="text-[11px] text-red-700 mt-1">
                        Booking may be <strong>overridden</strong> by an emergency vehicle.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky Footer / Summary ───────────────────── */}
          {selectedCharger && selectedStart && selectedEnd && (
            <div className="p-4 border-t border-border/50 bg-card/80 backdrop-blur space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatTime(selectedStart)} – {formatTime(selectedEnd)} · {selectedWindowStarts.length}×30m
                </span>
                <span className="font-bold text-lg">₹{totalPrice.toFixed(0)}</span>
              </div>
              <button
                disabled={Boolean(selectionError) || totalPrice <= 0 || !vehicle || !station}
                onClick={async () => {
                  try {
                    if (selectionError) { alert(selectionError); return }
                    if (!vehicle) { alert("Please select a vehicle first"); return }
                    if (!station) { alert("Station info not loaded yet"); return }
                    const slotId = await resolveFirstMicroSlotId()
                    const dt = new Date(selectedStart)
                    const hh = String(dt.getHours()).padStart(2, "0")
                    const mm = String(dt.getMinutes()).padStart(2, "0")
                    navigate("/booking/payment", {
                      state: {
                        stationId: station.id,
                        carId: vehicle.id,
                        station,
                        bookingV2: {
                          chargerId: selectedChargerId,
                          date: selectedDate,
                          startTime: `${hh}:${mm}`,
                          durationMinutes: selectedWindowStarts.length * 30,
                        },
                        slot: {
                          id: slotId,
                          start_time: selectedStart,
                          end_time: selectedEnd,
                          charger_type: selectedCharger.charger_type,
                          price_per_hour: 0,
                          duration_hours: durationHours,
                          total_price: totalPrice,
                        },
                      },
                    })
                  } catch (e: any) { alert(e?.message || "Unable to proceed") }
                }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 transition hover:opacity-90"
              >
                Proceed to Payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Map Area (Full Screen) ────────────────────────── */}
      <div className="flex-1 relative">
        {/* Back button overlay (when panel closed) */}
        <div className="absolute top-4 left-4 z-[1000]">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/80 backdrop-blur-lg border border-border/30 shadow-lg text-sm font-medium text-foreground hover:bg-card transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Toggle panel button (when panel closed) */}
        {!showPanel && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={() => setShowPanel(true)}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg text-sm font-medium hover:opacity-90 transition"
            >
              <Zap className="w-4 h-4 inline mr-1" /> Select Slot
            </button>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={15}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {station && (
            <Marker
              position={[Number(station.latitude) || 17.48, Number(station.longitude) || 78.52]}
              icon={stationIcon}
            />
          )}
        </MapContainer>
      </div>

      {/* Recently-released notification banner */}
      {showReleasedBanner && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/20 bg-accent shadow-lg text-sm text-primary">
            <BellRing className="w-4 h-4" />
            <span>A no-show slot just became available! Grab it before it's gone.</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SlotSelectionPage
