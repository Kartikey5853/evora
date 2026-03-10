import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { slotAPI, stationAPI, devAPI } from "@/lib/api"
import {
  Zap, Clock, AlertTriangle, CheckCircle, XCircle, UserX,
  ToggleLeft, ToggleRight, Search, CarFront, Timer, RefreshCw,
  ChevronDown, ChevronUp, Play, Square, UserCheck, UserMinus,
  ShieldAlert
} from "lucide-react"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

/* ── helpers ─────────────────────────────────────────────────────── */

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

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "–"

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "–"

const statusColor: Record<string, string> = {
  ACTIVE: "bg-accent text-primary border-primary/30",
  UPCOMING: "bg-blue-100 text-blue-800 border-blue-300",
  GRACE: "bg-amber-100 text-amber-800 border-amber-300",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  NO_SHOW: "bg-orange-100 text-orange-700 border-orange-300",
  OVERRIDDEN: "bg-purple-100 text-purple-700 border-purple-300",
}

const statusIcon: Record<string, any> = {
  ACTIVE: Zap,
  UPCOMING: Clock,
  GRACE: AlertTriangle,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  NO_SHOW: UserX,
  OVERRIDDEN: ShieldAlert,
}

/* ── countdown helpers ───────────────────────────────────────────── */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00"
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

/* ── component ───────────────────────────────────────────────────── */

const AdminSlotPage = () => {
  /* ── state ───────────────────────────────────────────────────── */
  const [grouped, setGrouped] = useState<any>({})
  const [loading, setLoading] = useState(true) // only true on very first load
  const initialLoadDone = useRef(false)
  const [selectedDate, setSelectedDate] = useState(() => toYyyyMmDd(new Date()))
  const [selectedStationId, setSelectedStationId] = useState("all")

  // Bypass toggle
  const [bypassEnabled, setBypassEnabled] = useState(false)

  // Ticket scan
  const [ticketInput, setTicketInput] = useState("")
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // Grace test
  const [graceResult, setGraceResult] = useState<string | null>(null)

  // Walk-in
  const [walkInCarNumber, setWalkInCarNumber] = useState("")
  const [walkInChargerId, setWalkInChargerId] = useState("")
  const [walkInDuration, setWalkInDuration] = useState(30)
  const [walkInResult, setWalkInResult] = useState<any>(null)
  const [walkInError, setWalkInError] = useState<string | null>(null)
  const [walkInBusy, setWalkInBusy] = useState(false)  // Stations + chargers for dropdowns
  const [stations, setStations] = useState<any[]>([])
  const [chargers, setChargers] = useState<any[]>([])

  // Section collapse
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Per-booking busy state for dev buttons
  const [busyActions, setBusyActions] = useState<Record<string, boolean>>({})

  const dateOptions = useMemo(() => {
    const today = new Date()
    return [toYyyyMmDd(today), toYyyyMmDd(addDays(today, 1)), toYyyyMmDd(addDays(today, 2))]
  }, [])

  /* ── data fetching ──────────────────────────────────────────── */

  const fetchBookings = useCallback(async () => {
    // Only show spinner on very first load
    if (!initialLoadDone.current) setLoading(true)
    try {
      const res = await slotAPI.getAdminBookings({
        station_id: selectedStationId === "all" ? undefined : selectedStationId,
        date: selectedDate,
      })
      setGrouped(res.data || {})
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [selectedStationId, selectedDate])

  const fetchStations = async () => {
    try {
      const res = await stationAPI.getStations()
      setStations(res.data || [])
    } catch {}
  }

  const fetchChargers = async (stationId: string) => {
    try {
      const res = await stationAPI.getChargersWithSlots(stationId)
      setChargers(res.data || [])
      if (res.data?.length) setWalkInChargerId(res.data[0].id)
    } catch {}
  }

  const fetchOverrides = async () => {
    try {
      const res = await devAPI.getOverrides()
      setBypassEnabled(Boolean(res.data?.bypass_enabled))
    } catch {}
  }
  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => {
    fetchStations()
    fetchOverrides()
  }, [])
  useEffect(() => {
    if (selectedStationId && selectedStationId !== "all") fetchChargers(selectedStationId)
  }, [selectedStationId])

  // Reset initial load flag when filters change
  useEffect(() => {
    initialLoadDone.current = false
  }, [selectedStationId, selectedDate])

  // Auto-refresh every 15s — silent (no loading spinner)
  useEffect(() => {
    const id = setInterval(fetchBookings, 15_000)
    return () => clearInterval(id)
  }, [fetchBookings])

  /* ── extract unique stations from bookings for filter ────────── */
  const bookingStations = useMemo(() => {
    const all: any[] = Object.values(grouped).flat()
    const map = new Map<string, string>()
    all.forEach((b: any) => {
      if (b.station_id) map.set(b.station_id, b.station_name || b.station_id)
    })
    stations.forEach(s => { if (s.id) map.set(s.id, s.name || s.id) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [grouped, stations])

  /* ── handlers ─────────────────────────────────────────────── */

  const handleToggleBypass = async () => {
    try {
      const res = await devAPI.toggleBypass()
      setBypassEnabled(Boolean(res.data?.bypass_enabled))
    } catch {}
  }

  const handleScan = async () => {
    const val = ticketInput.trim()
    if (!val) return
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const isTicket = val.startsWith("TICKET-")
      const res = await devAPI.adminScan(
        isTicket ? { ticket_id: val } : { booking_id: val }
      )
      setScanResult(res.data)
      fetchBookings()
    } catch (e: any) {
      setScanError(e?.response?.data?.detail || e?.message || "Scan failed")
    } finally {
      setScanning(false)
    }
  }

  const handleGraceTest = async (bookingId: string) => {
    setGraceResult(null)
    setBusyActions(p => ({ ...p, [bookingId]: true }))
    try {
      const res = await devAPI.graceTest(bookingId)
      setGraceResult(res.data?.message || "Grace started")
      fetchBookings()
    } catch (e: any) {
      setGraceResult(e?.response?.data?.detail || "Failed")
    } finally {
      setBusyActions(p => ({ ...p, [bookingId]: false }))
    }
  }

  const handleGraceArrive = async (bookingId: string) => {
    setBusyActions(p => ({ ...p, [bookingId]: true }))
    try {
      await devAPI.graceArrive(bookingId)
      fetchBookings()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed")
    } finally {
      setBusyActions(p => ({ ...p, [bookingId]: false }))
    }
  }

  const handleGraceNoShow = async (bookingId: string) => {
    setBusyActions(p => ({ ...p, [bookingId]: true }))
    try {
      await devAPI.graceNoShow(bookingId)
      fetchBookings()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed")
    } finally {
      setBusyActions(p => ({ ...p, [bookingId]: false }))
    }
  }

  const handleForceComplete = async (bookingId: string) => {
    setBusyActions(p => ({ ...p, [bookingId]: true }))
    try {
      await devAPI.forceComplete(bookingId)
      fetchBookings()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed")
    } finally {
      setBusyActions(p => ({ ...p, [bookingId]: false }))
    }
  }

  const handleWalkIn = async () => {
    if (!walkInCarNumber.trim() || !walkInChargerId) return
    setWalkInBusy(true)
    setWalkInError(null)
    setWalkInResult(null)
    try {
      const res = await devAPI.walkIn({
        car_number: walkInCarNumber.trim(),
        charger_id: walkInChargerId,
        duration_minutes: walkInDuration,
      })
      setWalkInResult(res.data)
      fetchBookings()
    } catch (e: any) {
      setWalkInError(e?.response?.data?.detail || e?.message || "Walk-in failed")
    } finally {
      setWalkInBusy(false)
    }
  }

  const toggleSection = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  /* ── section order + labels ──────────────────────────────────── */  const sections = [
    { key: "active", label: "Active Bookings", icon: Zap, accent: "primary" },
    { key: "grace", label: "Grace Period", icon: AlertTriangle, accent: "amber" },
    { key: "upcoming", label: "Upcoming Bookings", icon: Clock, accent: "blue" },
    { key: "completed", label: "Completed", icon: CheckCircle, accent: "gray" },
    { key: "no_show", label: "No-Show", icon: UserX, accent: "orange" },
    { key: "cancelled", label: "Cancelled", icon: XCircle, accent: "red" },
    { key: "overridden", label: "Overridden (Emergency)", icon: ShieldAlert, accent: "purple" },
  ]

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slot Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan tickets, manage grace periods, and handle walk-ins
          </p>
        </div>
        <button
          onClick={() => fetchBookings()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/40 transition text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Top Controls: 3-column grid ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">        {/* 1 ── Ticket Scan Card ──────────────────────────────────── */}
        <MagicBentoCard enableSpotlight className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold">Scan / Enter Ticket</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Enter a <span className="font-mono">TICKET-…</span> or booking ID. If bypass
            is <strong>off</strong>, it only works within the booked time window.
          </p>

          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="TICKET-ABC123 or booking UUID"
              value={ticketInput}
              onChange={e => setTicketInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleScan()}
            />
            <button
              onClick={handleScan}
              disabled={scanning || !ticketInput.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {scanning ? "…" : "Scan"}
            </button>
          </div>

          {/* Bypass toggle */}
          <button
            onClick={handleToggleBypass}            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition ${
              bypassEnabled
                ? "bg-accent border-primary/30 text-primary"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {bypassEnabled
              ? <ToggleRight className="w-5 h-5" />
              : <ToggleLeft className="w-5 h-5" />}
            Bypass: {bypassEnabled ? "ON — skips time check" : "OFF — time check enforced"}
          </button>

          {scanError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {scanError}
            </div>
          )}          {scanResult && (
            <div className="p-3 rounded-lg bg-accent border border-primary/20 text-sm space-y-1">
              <p className="font-medium text-primary">✓ Charging started</p>
              <p className="text-primary">Ticket: {scanResult.ticket_id}</p>
              <p className="text-primary">
                {fmtTime(scanResult.start_time)} – {fmtTime(scanResult.end_time)}
              </p>
              {scanResult.user && (
                <p className="text-primary">Owner: {scanResult.user.name} ({scanResult.user.email})</p>
              )}
              {scanResult.car && (
                <p className="text-primary">Car: {scanResult.car.brand} {scanResult.car.model} • {scanResult.car.car_number}</p>
              )}
            </div>
          )}
        </MagicBentoCard>        {/* 2 ── Walk-in Card ─────────────────────────────────────── */}
        <MagicBentoCard enableSpotlight className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CarFront className="w-5 h-5 text-violet-600" />
            <h2 className="font-semibold">Walk-in Booking</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Enter any car number — no registration needed. Books + starts immediately.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Station</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={selectedStationId === "all" ? "" : selectedStationId}
              onChange={e => {
                const val = e.target.value
                if (val) { setSelectedStationId(val); fetchChargers(val) }
              }}
            >
              <option value="">Select station…</option>
              {bookingStations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {chargers.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Charger</label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm"
                value={walkInChargerId}
                onChange={e => setWalkInChargerId(e.target.value)}
              >
                {chargers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.charger_type} ({c.charger_type})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="Car number (e.g. KA01AB1234)"
              value={walkInCarNumber}
              onChange={e => setWalkInCarNumber(e.target.value)}
            />
            <select
              className="w-20 px-2 py-2 border rounded-lg text-sm"
              value={walkInDuration}
              onChange={e => setWalkInDuration(Number(e.target.value))}
            >
              <option value={30}>30m</option>
              <option value={60}>60m</option>
              <option value={90}>90m</option>
              <option value={120}>2h</option>
            </select>
          </div>

          <button
            onClick={handleWalkIn}
            disabled={walkInBusy || !walkInCarNumber.trim() || !walkInChargerId}
            className="w-full px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition"
          >
            {walkInBusy ? "Booking…" : "Book & Start Now"}
          </button>

          {walkInError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {walkInError}
            </div>
          )}
          {walkInResult && (
            <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm space-y-1">
              <p className="font-medium text-violet-800">✓ Walk-in booked & active</p>
              <p className="text-violet-700">Ticket: {walkInResult.ticket_id}</p>
              <p className="text-violet-700">
                {fmtTime(walkInResult.start_time)} – {fmtTime(walkInResult.end_time)}
              </p>
              <p className="text-violet-700">
                Car: {walkInResult.car_number || walkInResult.car?.car_number}
                {walkInResult.car ? ` (${walkInResult.car.brand} ${walkInResult.car.model})` : " (unregistered)"}
              </p>
              {walkInResult.user && (
                <p className="text-violet-700">Owner: {walkInResult.user.name}</p>
              )}
              {walkInResult.total_amount != null && (
                <p className="text-violet-700">Amount: ₹{Number(walkInResult.total_amount).toFixed(2)}</p>
              )}
            </div>          )}
        </MagicBentoCard>

        {/* 3 ── Grace Test Info Card ─────────────────────────────── */}
        <MagicBentoCard enableSpotlight className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold">Grace Period Test</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Force an <strong>UPCOMING</strong> booking into <strong>GRACE</strong>.
            The 10-minute countdown starts — if no ticket is scanned, the first slot
            goes back to the pool and appears as available on the user side.
          </p>

          <p className="text-xs text-muted-foreground">
            Use the <strong>⏱ Grace Test</strong> button on any UPCOMING booking below.
            GRACE bookings get <strong>Car Arrived / Didn't Arrive</strong> dev buttons.
          </p>          {graceResult && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              {graceResult}
            </div>          )}
        </MagicBentoCard>
      </div>      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-muted/20">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Station</label>
          <select
            className="px-3 py-1.5 border rounded-lg text-sm bg-card"
            value={selectedStationId}
            onChange={e => setSelectedStationId(e.target.value)}
          >
            <option value="all">All Stations</option>
            {bookingStations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">          <label className="text-sm font-medium">Date</label>
          <select
            className="px-3 py-1.5 border rounded-lg text-sm bg-card"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          >
            {dateOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Booking Sections ─────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading bookings…</div>
      ) : (
        <div className="space-y-4">
          {sections.map(({ key, label, icon: Icon, accent }) => {
            const items: any[] = grouped[key] || []
            const isCollapsed = collapsed[key]

            return (
              <div key={key} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${accent === "primary" ? "text-primary" : `text-${accent}-600`}`} />
                    <span className="font-semibold">{label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[key.toUpperCase()] || "bg-muted text-muted-foreground"}`}>
                      {items.length}
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                {!isCollapsed && (
                  <div className="border-t">
                    {items.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-muted-foreground">No bookings</p>
                    ) : (
                      <div className="divide-y">
                        {items.map((b: any) => (
                          <BookingCard
                            key={b.booking_id}
                            booking={b}
                            onGraceTest={handleGraceTest}
                            onGraceArrive={handleGraceArrive}
                            onGraceNoShow={handleGraceNoShow}
                            onForceComplete={handleForceComplete}
                            busy={!!busyActions[b.booking_id]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Booking Card Sub-component ─────────────────────────────────── */

function BookingCard({
  booking: b,
  onGraceTest,
  onGraceArrive,
  onGraceNoShow,
  onForceComplete,
  busy,
}: {
  booking: any
  onGraceTest: (id: string) => void
  onGraceArrive: (id: string) => void
  onGraceNoShow: (id: string) => void
  onForceComplete: (id: string) => void
  busy: boolean
}) {
  const StatusIcon = statusIcon[b.booking_status] || Clock
  const now = useNow()

  // Timer calculations
  const endMs = b.end_time ? new Date(b.end_time).getTime() : 0
  const startMs = b.start_time ? new Date(b.start_time).getTime() : 0
  const totalDurationMs = endMs - startMs
  const remainingMs = endMs - now

  // Grace: 10 min from start_time
  const graceDeadlineMs = startMs + 10 * 60 * 1000
  const graceRemainingMs = graceDeadlineMs - now

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Row 1: main info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4 text-muted-foreground" />
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[b.booking_status] || ""}`}>
            {b.booking_status}
          </span>
          <span className="text-sm font-medium">
            {b.station_name || b.station_id}
          </span>
          {(b.charger_name || b.charger_type) && (
            <span className="text-xs text-muted-foreground">
              • {b.charger_name || ""} {b.charger_type ? `(${b.charger_type})` : ""}
            </span>
          )}
        </div>        <span className="text-xs text-muted-foreground font-mono">{b.ticket_id}</span>
      </div>

      {/* Override info badge */}
      {b.was_overridden && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-700">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          <span>This booking was overridden by an emergency vehicle{b.overridden_by_booking_id ? ` (${b.overridden_by_booking_id.slice(0, 8)}…)` : ""}</span>
        </div>
      )}

      {/* Row 2: time + amount */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>🕐 {fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
        {b.total_amount != null && <span>💰 ₹{Number(b.total_amount).toFixed(2)}</span>}
        {b.created_at && <span>Created: {fmtDateTime(b.created_at)}</span>}
      </div>

      {/* Row 3: owner + car */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {b.user_name && (
          <span className="text-muted-foreground">
            👤 {b.user_name} {b.user_email ? `(${b.user_email})` : ""}
          </span>
        )}
        {b.car_number && (
          <span className="text-muted-foreground">
            🚗 {b.car_brand} {b.car_model} • <span className="font-mono font-medium">{b.car_number}</span>
          </span>
        )}
        {!b.user_name && !b.car_number && (
          <span className="text-muted-foreground italic">Anonymous walk-in</span>
        )}
      </div>

      {/* ── ACTIVE: Charging timer + progress slider + Complete button ── */}
      {b.booking_status === "ACTIVE" && totalDurationMs > 0 && (        <div className="space-y-2 p-3 rounded-lg bg-accent border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Charging in progress</span>
            </div>
            <span className="text-sm font-mono font-semibold text-primary">
              {remainingMs > 0 ? formatCountdown(remainingMs) : "Done!"}
            </span>
          </div>

          {/* Progress bar */}          <div className="w-full bg-primary/20 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, Math.max(0, ((totalDurationMs - remainingMs) / totalDurationMs) * 100))}%` }}
            />
          </div>          <div className="flex items-center justify-between text-xs text-primary">
            <span>{fmtTime(b.start_time)}</span>
            <span>{fmtTime(b.end_time)}</span>
          </div>

          {/* Dev button: Force Complete */}
          <button
            onClick={() => onForceComplete(b.booking_id)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-50 transition"
          >
            <Square className="w-3.5 h-3.5" />
            {busy ? "…" : "⚡ Complete Charging (Dev)"}
          </button>
        </div>
      )}

      {/* ── GRACE: 10-min countdown + Car Arrived / Didn't Arrive buttons ── */}
      {b.booking_status === "GRACE" && (
        <div className="space-y-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Grace period</span>
            </div>
            <span className={`text-sm font-mono font-semibold ${graceRemainingMs > 0 ? "text-amber-700" : "text-red-600"}`}>
              {graceRemainingMs > 0 ? formatCountdown(graceRemainingMs) : "Expired!"}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-amber-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-1000 ${graceRemainingMs > 0 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, Math.max(0, ((10 * 60 * 1000 - graceRemainingMs) / (10 * 60 * 1000)) * 100))}%` }}
            />
          </div>

          <p className="text-xs text-amber-700">
            {graceRemainingMs > 0
              ? "Waiting for car arrival. If no scan within 10 minutes, slot returns to pool."
              : "Grace period expired — slot eligible for release."}
          </p>

          {/* Dev buttons: Car Arrived / Car Didn't Arrive */}
          <div className="flex gap-2 pt-1">
            <button              onClick={() => onGraceArrive(b.booking_id)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {busy ? "…" : "Car Arrived (Dev)"}
            </button>
            <button
              onClick={() => onGraceNoShow(b.booking_id)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
            >
              <UserMinus className="w-3.5 h-3.5" />
              {busy ? "…" : "Didn't Arrive (Dev)"}
            </button>
          </div>
        </div>
      )}

      {/* ── UPCOMING: Grace Test button ── */}
      {b.booking_status === "UPCOMING" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onGraceTest(b.booking_id)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition border border-amber-200 disabled:opacity-50"
          >
            <Timer className="w-3.5 h-3.5" />
            {busy ? "…" : "⏱ Grace Test (Dev)"}
          </button>
        </div>
      )}
    </div>
  )
}

export default AdminSlotPage
