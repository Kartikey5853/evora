import { useLocation, useNavigate } from "react-router-dom"
import QRCode from "react-qr-code"
import { MapPin, AlertTriangle, ArrowLeft } from "lucide-react"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

const TicketPage = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const { ticketId, slot, station, transactionId, amount, qrPayload } = location.state || {}

  // Safety guard
  if (!ticketId || !slot || !station) {
    navigate("/dashboard")
    return null
  }

  const mapsUrl = `https://www.google.com/maps?q=${station.latitude},${station.longitude}`

  return (    <div className="min-h-screen bg-background flex items-center justify-center">
      <MagicBentoCard enableSpotlight enableParticles className="max-w-md w-full p-6 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <button
            onClick={() => navigate("/dashboard/transactions")}
            className="text-sm font-medium text-primary hover:underline"
          >
            View in Transactions
          </button>
        </div>

        <h1 className="text-xl font-semibold text-center">
          Charging Ticket
        </h1>

        {/* QR CODE */}
        <div className="flex justify-center">
          <QRCode value={qrPayload || ticketId} size={200} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Scan this QR at the charging station to start charging
        </p>

        {/* SLOT INFO */}
        <div className="text-sm space-y-1">
          <p><strong>Ticket ID:</strong> {ticketId}</p>
          {transactionId && <p><strong>Transaction ID:</strong> {transactionId}</p>}
          {typeof amount === 'number' && <p><strong>Amount Paid:</strong> ₹{amount.toFixed(2)}</p>}
          <p><strong>Station:</strong> {station.name}</p>
          <p>
            <strong>Date:</strong> {new Date(slot.start_time).toLocaleDateString()}
          </p>
          <p>
            <strong>Time:</strong> {new Date(slot.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {new Date(slot.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p><strong>Charger:</strong> {slot.charger_type}</p>
        </div>

        {/* MAP LINK */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          <MapPin className="w-4 h-4" />
          Navigate to Station
        </a>

        {/* WARNING */}
        <div className="flex gap-2 text-xs text-yellow-700 bg-yellow-100 p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <p>
            Please arrive on time. If you are late, your slot will end as scheduled
            and cannot be extended.
          </p>
        </div>

        {/* NEXT STEP CTA */}        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-3 rounded-xl border font-medium hover:bg-muted"
        >
          View My Bookings
        </button>

      </MagicBentoCard>
    </div>
  )
}

export default TicketPage
