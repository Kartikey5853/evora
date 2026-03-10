import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin, Zap, ArrowLeft, FileText, X } from "lucide-react"
import { stationAPI, chargerAPI } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import GlassSurface from "@/components/ui/GlassSurface"

const chargerTypes = ["Type 1", "Type 2", "CCS2", "CHAdeMO", "GB/T"]

const AdminStationPage = () => {
  const [stations, setStations] = useState<any[]>([])
  const navigate = useNavigate()
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)
  const [showPanel, setShowPanel] = useState(true)
  const [form, setForm] = useState({
    name: "",
    address: "",
    document_url: "",
    charger_name: "",
    charger_type: chargerTypes[0],
    power_kw: 22,
    price_per_hour: 100,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchStations() }, [])

  const fetchStations = async () => {
    setLoading(true)
    try {
      const res = await stationAPI.getStations()
      setStations(res.data)
    } catch (err) {
      setStations([])
    } finally {
      setLoading(false)
    }
  }

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setSelectedLocation([e.latlng.lat, e.latlng.lng])
        setShowPanel(true)
      },
    })
    return null
  }

  const handleFormChange = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handlePublish = async () => {
    if (!selectedLocation) return

    const stationRes = await stationAPI.addStation({
      name: form.name,
      address: form.address,
      latitude: String(selectedLocation[0]),
      longitude: String(selectedLocation[1]),
      host_id: 'admin-host-id',
      document_url: form.document_url,
    })
    const stationId = stationRes.data.id as string

    await chargerAPI.addCharger(stationId, {
      charger_type: form.charger_type,
      power_kw: Number(form.power_kw),
      price_per_hour: Number(form.price_per_hour),
    })

    setSelectedLocation(null)
    setForm({
      name: "",
      address: "",
      document_url: "",
      charger_name: "",
      charger_type: chargerTypes[0],
      power_kw: 22,
      price_per_hour: 100,
    })
    fetchStations()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* ── Full-screen Map ────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer center={[17.385, 78.4867]} zoom={13} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler />
          {stations.map((station: any) => (
            <Marker key={station.id} position={[Number(station.latitude), Number(station.longitude)]} />
          ))}
          {selectedLocation && <Marker position={selectedLocation} />}
        </MapContainer>

        {/* Back button overlay */}
        <div className="absolute top-4 left-4 z-[1000]">
          <button
            onClick={() => navigate("/admin/dashboard")}
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
              <MapPin className="w-4 h-4 inline mr-1" /> Create Station
            </button>
          </div>
        )}
      </div>

      {/* ── Glass Side Panel ──────────────────────────────── */}
      {showPanel && (
        <div className="w-full md:w-[40%] h-full flex flex-col bg-card/70 backdrop-blur-2xl backdrop-saturate-150 border-l border-border/30 shadow-2xl z-[1000] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Create Station</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Click map to pick location</p>
            </div>
            <button onClick={() => setShowPanel(false)} className="p-2 rounded-lg hover:bg-muted/50 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4 text-primary" /> Location</div>
              <div className="p-3 rounded-xl border border-border bg-muted/30">
                {selectedLocation ? (
                  <p className="text-sm font-mono">{selectedLocation[0].toFixed(5)}, {selectedLocation[1].toFixed(5)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click on map to select</p>
                )}
              </div>
            </div>

            {/* Station Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4 text-primary" /> Station Details</div>
              <input className="input-clean" placeholder="Station Name" value={form.name} onChange={e => handleFormChange("name", e.target.value)} />
              <input className="input-clean" placeholder="Address" value={form.address} onChange={e => handleFormChange("address", e.target.value)} />
            </div>

            {/* Document */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><FileText className="w-4 h-4 text-primary" /> Proof Document</div>
              <input className="input-clean" placeholder="Document URL (license, permit...)" value={form.document_url} onChange={e => handleFormChange("document_url", e.target.value)} />
              <p className="text-xs text-muted-foreground">Required for superadmin approval</p>
            </div>

            {/* Charger Config */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Zap className="w-4 h-4 text-primary" /> Charger</div>
              <select className="input-clean" value={form.charger_type} onChange={e => handleFormChange("charger_type", e.target.value)}>
                {chargerTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input-clean" placeholder="kW" value={form.power_kw} onChange={e => handleFormChange("power_kw", Number(e.target.value))} />
                <input type="number" className="input-clean" placeholder="₹/hr" value={form.price_per_hour} onChange={e => handleFormChange("price_per_hour", Number(e.target.value))} />
              </div>
            </div>

            {/* Publish */}
            <button
              disabled={!selectedLocation || !form.name || !form.address || !form.document_url}
              onClick={handlePublish}
              className={`w-full py-3 rounded-xl font-medium transition text-primary-foreground ${
                !selectedLocation || !form.document_url
                  ? "bg-primary/40 cursor-not-allowed"
                  : "bg-primary hover:opacity-90 shadow-lg"
              }`}
            >
              Publish Station (Pending Approval)
            </button>

            {/* Existing Stations */}
            <div className="pt-4 border-t border-border/50">
              <h2 className="text-sm font-medium mb-3">Existing Stations</h2>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : stations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stations created yet</p>
              ) : (
                <div className="space-y-2">
                  {stations.map((station: any) => (
                    <div key={station.id} className="p-3 rounded-xl border border-border bg-muted/20">
                      <p className="font-medium text-sm">{station.name}</p>
                      <p className="text-xs text-muted-foreground">{station.address}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminStationPage