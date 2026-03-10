import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CheckCircle, ArrowLeft, Wallet, Info } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { bookingAPI, walletAPI } from "@/lib/api"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

/* ----------------------------
   Types
----------------------------- */
interface PaymentSlot {
  id: string            
  start_time: string
  end_time: string
  charger_type: string
  price_per_hour: number
  duration_hours: number
  total_price: number
}

/* ----------------------------
   Page
----------------------------- */
const PaymentPage = () => {
  
  const location = useLocation()
const navigate = useNavigate()

const state = location.state as {
  stationId: string
  carId: string
  station: {
    latitude: number
    longitude: number
    name?: string
  }
  slot: PaymentSlot
} | null

const data = state || {} as any
const slot = data.slot

  useEffect(() => {
  if (!state?.slot || !state?.stationId || !state?.carId) {
    navigate("/dashboard")
  }
}, [state, navigate])

  /* ----------------------------
     Payment State
  ----------------------------- */
  const [orderId] = useState(uuidv4())
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [revenueSplit, setRevenueSplit] = useState<{ host_share: number; platform_share: number } | null>(null)

  useEffect(() => {
    walletAPI.getBalance().then(res => setWalletBalance(res.data.balance)).catch(() => {});
  }, []);

  /* ----------------------------
     Mock UPI Payload
  ----------------------------- */
  // QR code removed by design; we only show a confirmation button.

  /* ----------------------------
     Handlers
  ----------------------------- */
  const handleConfirmPayment = async () => {
  try {
    const txnId = "TXN-" + uuidv4().slice(0, 12).toUpperCase()
    setTransactionId(txnId)

    const isWindowV2 = Boolean((state as any)?.bookingV2)

    const res = isWindowV2
      ? await bookingAPI.createBookingV2({
          charger_id: (state as any).bookingV2.chargerId,
          station_id: state.stationId,
          car_id: state.carId,
          date: (state as any).bookingV2.date,
          start_time: (state as any).bookingV2.startTime,
          duration_minutes: (state as any).bookingV2.durationMinutes ?? 30,
        })
      : await bookingAPI.createBooking({
          station_id: state.stationId,
          slot_id: slot.id,
          car_id: state.carId,
          order_id: orderId,
          transaction_id: txnId,
          amount: slot.total_price,
        })

    const bookingId = res.data.booking_id
    const ticketId = res.data.ticket_id
    const amountPaid = isWindowV2 ? res.data.amount : slot.total_price

    // Capture revenue split from response
    if (res.data.host_share !== undefined) {
      setRevenueSplit({
        host_share: res.data.host_share,
        platform_share: res.data.platform_share,
      });
    }

    // Refresh wallet balance after debit
    walletAPI.getBalance().then(r => setWalletBalance(r.data.balance)).catch(() => {});

    const qrPayload = JSON.stringify({ ticketId, carId: state.carId })

    setPaymentSuccess(true)

    // Delay navigation slightly to show success + split
    setTimeout(() => {
      navigate(`/booking/ticket/${bookingId}`, {
        state: {
          ticketId,
          slot,
          station: data.station,
          transactionId: txnId,
          amount: amountPaid,
          qrPayload,
        },
      })
    }, 3000)
  } catch (err: any) {
    console.error(err)
    const detail = err?.response?.data?.detail
    alert(detail || "Payment failed. Please try again.")
  }
}

  /* ----------------------------
     Render
  ----------------------------- */  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft />
          </button>

          <h1 className="text-lg font-semibold">
            Secure Payment
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Order Summary */}
        <MagicBentoCard enableParticles={false} enableSpotlight>
        <div className="p-6 space-y-3">
          <h2 className="font-semibold">Order Summary</h2>

          <div className="text-sm space-y-1">
            <p><strong>Order ID:</strong> {orderId}</p>
            <p><strong>Charger:</strong> {slot.charger_type}</p>
            <p>
              <strong>Time:</strong>{" "}
              {new Date(slot.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(slot.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p><strong>Duration:</strong> {slot.duration_hours} hour(s)</p>
            <p><strong>Rate:</strong> ₹{slot.price_per_hour}/hr</p>
          </div>

          <div className="pt-3 border-t text-lg font-semibold">
            Total: ₹{slot.total_price.toFixed(2)}
          </div>

          {/* Wallet Balance */}
          {walletBalance !== null && (
            <div className="flex items-center gap-2 pt-2 text-sm">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">EV Points Balance:</span>
              <span className={`font-semibold ${walletBalance >= slot.total_price ? 'text-primary' : 'text-red-500'}`}>
                {walletBalance.toFixed(2)} pts
              </span>
              {walletBalance < slot.total_price && (
                <span className="text-xs text-red-500">(Insufficient — need {(slot.total_price - walletBalance).toFixed(2)} more)</span>
              )}
            </div>
          )}

          {/* Revenue Split */}
          {revenueSplit && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="w-4 h-4 text-blue-500" />
                Payment Breakdown
              </div>              <div className="text-sm text-muted-foreground flex justify-between">
                <span>Host Earnings (80%)</span>
                <span className="font-mono font-medium text-foreground">₹{revenueSplit.host_share.toFixed(2)}</span>
              </div>
              <div className="text-sm text-muted-foreground flex justify-between">
                <span>Platform Fee (20%)</span>
                <span className="font-mono font-medium text-foreground">₹{revenueSplit.platform_share.toFixed(2)}</span>
              </div>
            </div>          )}
        </div>
        </MagicBentoCard>

        {/* UPI Payment */}
        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-6 space-y-4 text-center">
            <h2 className="font-semibold">Pay using UPI</h2>

            <p className="text-sm text-muted-foreground">
              Complete the payment in your UPI app, then confirm below.
            </p>

            {!paymentSuccess ? (
              <button
                onClick={handleConfirmPayment}
                className="btn-primary mx-auto"
              >
                Confirm Payment
              </button>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-2 text-primary">
                <CheckCircle className="w-6 h-6" />
                <p className="font-medium">Payment Confirmed</p>
                <p className="text-sm">Transaction ID: {transactionId}</p>
              </div>
            )}
          </div>
        </MagicBentoCard>

      </div>
    </div>
  )
}

export default PaymentPage
