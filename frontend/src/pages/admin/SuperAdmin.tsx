import { useEffect, useState } from "react"
import { ShieldAlert, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Building2 } from "lucide-react"
import { superadminAPI } from "@/lib/api"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

/*  Emergency Requests  */
interface EmergencyRequest {
  car_id: string; brand: string; model: string; car_number: string
  charger_type: string; emergency_type: string; emergency_proof_url: string
  emergency_status: string; created_at: string
  user: { id: string; name: string; email: string }
}

/*  Station Requests  */
interface StationRequest {
  station_id: string; name: string; address: string; latitude: string; longitude: string
  document_url: string | null; approval_status: string; is_active: boolean
  created_at: string
  host: { id: string; name: string; email: string }
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-accent text-primary border-primary/30",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
}
const typeEmoji: Record<string, string> = { POLICE: "\u{1F694}", AMBULANCE: "\u{1F691}", FIRE: "\u{1F692}" }

type PageTab = "vehicles" | "stations"

const SuperAdminPage = () => {
  const [pageTab, setPageTab] = useState<PageTab>("vehicles")

  //  Emergency vehicle state 
  const [requests, setRequests] = useState<EmergencyRequest[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [busyReq, setBusyReq] = useState<Record<string, boolean>>({})
  const [filterReq, setFilterReq] = useState<"ALL"|"PENDING"|"APPROVED"|"REJECTED">("ALL")

  //  Station state 
  const [stations, setStations] = useState<StationRequest[]>([])
  const [loadingSta, setLoadingSta] = useState(true)
  const [busySta, setBusySta] = useState<Record<string, boolean>>({})
  const [filterSta, setFilterSta] = useState<"ALL"|"PENDING"|"APPROVED"|"REJECTED">("ALL")

  //  Fetch 
  const fetchEmergency = async () => {
    setLoadingReqs(true)
    try { const r = await superadminAPI.getEmergencyRequests(); setRequests(r.data || []) }
    catch {} finally { setLoadingReqs(false) }
  }
  const fetchStations = async () => {
    setLoadingSta(true)
    try { const r = await superadminAPI.getStationRequests(); setStations(r.data || []) }
    catch {} finally { setLoadingSta(false) }
  }
  useEffect(() => { fetchEmergency(); fetchStations() }, [])

  //  Emergency handlers 
  const handleApproveEm = async (carId: string) => {
    setBusyReq(p => ({ ...p, [carId]: true }))
    try { await superadminAPI.approveRequest(carId); setRequests(prev => prev.map(r => r.car_id === carId ? { ...r, emergency_status: "APPROVED" } : r)) }
    catch (err: any) { alert(err?.response?.data?.detail || "Failed") }
    finally { setBusyReq(p => ({ ...p, [carId]: false })) }
  }
  const handleRejectEm = async (carId: string) => {
    setBusyReq(p => ({ ...p, [carId]: true }))
    try { await superadminAPI.rejectRequest(carId); setRequests(prev => prev.map(r => r.car_id === carId ? { ...r, emergency_status: "REJECTED" } : r)) }
    catch (err: any) { alert(err?.response?.data?.detail || "Failed") }
    finally { setBusyReq(p => ({ ...p, [carId]: false })) }
  }

  //  Station handlers 
  const handleApproveSt = async (id: string) => {
    setBusySta(p => ({ ...p, [id]: true }))
    try { await superadminAPI.approveStation(id); setStations(prev => prev.map(s => s.station_id === id ? { ...s, approval_status: "APPROVED" } : s)) }
    catch (err: any) { alert(err?.response?.data?.detail || "Failed") }
    finally { setBusySta(p => ({ ...p, [id]: false })) }
  }
  const handleRejectSt = async (id: string) => {
    setBusySta(p => ({ ...p, [id]: true }))
    try { await superadminAPI.rejectStation(id); setStations(prev => prev.map(s => s.station_id === id ? { ...s, approval_status: "REJECTED" } : s)) }
    catch (err: any) { alert(err?.response?.data?.detail || "Failed") }
    finally { setBusySta(p => ({ ...p, [id]: false })) }
  }

  const filteredReqs = filterReq === "ALL" ? requests : requests.filter(r => r.emergency_status === filterReq)
  const filteredStas = filterSta === "ALL" ? stations : stations.filter(s => s.approval_status === filterSta)
  const pendingEmCount = requests.filter(r => r.emergency_status === "PENDING").length
  const pendingStCount = stations.filter(s => s.approval_status === "PENDING").length

  return (
    <div className="w-full space-y-6">
      {/* Pagelevel tabs */}
      <div className="flex gap-3 border-b pb-3">
        <button onClick={() => setPageTab("vehicles")} className={`px-5 py-2.5 rounded-t-lg font-medium text-sm transition ${pageTab === "vehicles" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40"}`}>
          <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Emergency Vehicles {pendingEmCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">{pendingEmCount}</span>}</span>
        </button>
        <button onClick={() => setPageTab("stations")} className={`px-5 py-2.5 rounded-t-lg font-medium text-sm transition ${pageTab === "stations" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40"}`}>
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Station Approvals {pendingStCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">{pendingStCount}</span>}</span>
        </button>
      </div>

      {/*  EMERGENCY VEHICLES TAB  */}
      {pageTab === "vehicles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-red-600" /> Emergency Vehicle Requests</h1>
              <p className="text-sm text-muted-foreground mt-1">Approve or reject emergency vehicle registrations</p>
            </div>
            <button onClick={fetchEmergency} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/40 text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>

          <div className="flex gap-2">{(["ALL","PENDING","APPROVED","REJECTED"] as const).map(f => (
            <button key={f} onClick={() => setFilterReq(f)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${filterReq === f ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:bg-muted/40"}`}>
              {f}{f==="PENDING" && pendingEmCount>0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">{pendingEmCount}</span>}
            </button>
          ))}</div>

          {loadingReqs ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredReqs.length === 0 ? <div className="text-center py-12 text-muted-foreground">No {filterReq==="ALL"?"":filterReq.toLowerCase()} requests</div> : (
            <div className="space-y-4">{filteredReqs.map(r => (
              <MagicBentoCard enableSpotlight key={r.car_id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeEmoji[r.emergency_type]||"\u{1F6A8}"}</span>
                    <div><p className="font-semibold">{r.brand} {r.model}</p><p className="text-sm text-muted-foreground font-mono">{r.car_number}</p></div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${statusBadge[r.emergency_status]||""}`}>
                    {r.emergency_status==="PENDING"&&<Clock className="w-3 h-3"/>}{r.emergency_status==="APPROVED"&&<CheckCircle className="w-3 h-3"/>}{r.emergency_status==="REJECTED"&&<XCircle className="w-3 h-3"/>}{r.emergency_status}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Type: </span><span className="font-medium">{r.emergency_type}</span></div>
                  <div><span className="text-muted-foreground">Charger: </span><span className="font-medium">{r.charger_type}</span></div>
                  <div><span className="text-muted-foreground">User: </span><span className="font-medium">{r.user.name}</span> <span className="text-muted-foreground">({r.user.email})</span></div>
                  <div><span className="text-muted-foreground">Submitted: </span><span className="font-medium">{new Date(r.created_at).toLocaleDateString()}</span></div>
                </div>
                {r.emergency_proof_url && <a href={r.emergency_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><ExternalLink className="w-4 h-4"/>View Proof Document</a>}
                {r.emergency_status==="PENDING" && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => handleApproveEm(r.car_id)} disabled={!!busyReq[r.car_id]} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"><CheckCircle className="w-4 h-4"/>{busyReq[r.car_id]?"...":"Approve"}</button>
                    <button onClick={() => handleRejectEm(r.car_id)} disabled={!!busyReq[r.car_id]} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"><XCircle className="w-4 h-4"/>{busyReq[r.car_id]?"...":"Reject"}</button>
                  </div>
                )}
              </MagicBentoCard>
            ))}</div>
          )}
        </div>
      )}

      {/*  STATION APPROVALS TAB  */}
      {pageTab === "stations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-blue-600" /> Station Approval Requests</h1>
              <p className="text-sm text-muted-foreground mt-1">Review station documents and approve or reject</p>
            </div>
            <button onClick={fetchStations} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/40 text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>

          <div className="flex gap-2">{(["ALL","PENDING","APPROVED","REJECTED"] as const).map(f => (
            <button key={f} onClick={() => setFilterSta(f)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${filterSta === f ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:bg-muted/40"}`}>
              {f}{f==="PENDING" && pendingStCount>0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">{pendingStCount}</span>}
            </button>
          ))}</div>

          {loadingSta ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredStas.length === 0 ? <div className="text-center py-12 text-muted-foreground">No {filterSta==="ALL"?"":filterSta.toLowerCase()} station requests</div> : (
            <div className="space-y-4">{filteredStas.map(s => (
              <MagicBentoCard enableSpotlight key={s.station_id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-semibold text-lg">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.address}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${statusBadge[s.approval_status]||""}`}>
                    {s.approval_status==="PENDING"&&<Clock className="w-3 h-3"/>}{s.approval_status==="APPROVED"&&<CheckCircle className="w-3 h-3"/>}{s.approval_status==="REJECTED"&&<XCircle className="w-3 h-3"/>}{s.approval_status}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Host: </span><span className="font-medium">{s.host.name}</span> <span className="text-muted-foreground">({s.host.email})</span></div>
                  <div><span className="text-muted-foreground">Location: </span><span className="font-medium">{Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)}</span></div>
                  <div><span className="text-muted-foreground">Created: </span><span className="font-medium">{new Date(s.created_at).toLocaleDateString()}</span></div>
                </div>
                {s.document_url && <a href={s.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><ExternalLink className="w-4 h-4"/>View Station Document</a>}
                {s.approval_status==="PENDING" && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => handleApproveSt(s.station_id)} disabled={!!busySta[s.station_id]} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"><CheckCircle className="w-4 h-4"/>{busySta[s.station_id]?"...":"Approve"}</button>
                    <button onClick={() => handleRejectSt(s.station_id)} disabled={!!busySta[s.station_id]} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"><XCircle className="w-4 h-4"/>{busySta[s.station_id]?"...":"Reject"}</button>
                  </div>
                )}
              </MagicBentoCard>
            ))}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default SuperAdminPage
