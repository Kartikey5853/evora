import { useState, useEffect } from "react"
import { Wallet, ArrowDownToLine, TrendingUp, Info, Banknote } from "lucide-react"
import { walletAPI, adminAnalyticsAPI } from "@/lib/api"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

const HostWalletPage = () => {
  const [balance, setBalance] = useState<number>(0)
  const [totalEarnings, setTotalEarnings] = useState<number>(0)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawing, setWithdrawing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [balRes, earnRes] = await Promise.all([
        walletAPI.getHostBalance(),
        adminAnalyticsAPI.getEarnings(365),
      ])
      setBalance(balRes.data.balance || 0)
      setTotalEarnings(earnRes.data.total || 0)
    } catch {}
  }

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0 || amt > balance) return
    setWithdrawing(true)
    setMessage(null)
    try {
      await walletAPI.hostWithdraw(amt)
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || "Withdrawal failed")
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in w-full">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">
          Host Wallet
        </h1>
        <p className="text-muted-foreground mt-1">
          Your earnings from charging bookings
        </p>
      </div>

      {/* Balance Card */}
      <MagicBentoCard enableParticles enableSpotlight className="!border-primary/20">
        <div className="rounded-2xl gradient-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-8 h-8" />
            <span className="text-lg font-medium opacity-90">Available Balance</span>
          </div>
          <p className="text-5xl font-bold tracking-tight">
            ₹{balance.toFixed(2)}
          </p>
          <p className="text-sm mt-3 opacity-80">
            You receive 80% of every booking. Platform keeps 20%.
          </p>
        </div>
      </MagicBentoCard>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Lifetime Earnings</p>
              <p className="text-xl font-bold text-foreground">₹{totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </MagicBentoCard>
        <MagicBentoCard enableParticles={false} enableSpotlight>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <Banknote className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue Split</p>
              <p className="text-xl font-bold text-foreground">80% Host / 20% Platform</p>
            </div>
          </div>
        </MagicBentoCard>
      </div>

      {/* Withdraw Section */}
      <MagicBentoCard enableParticles={false} enableSpotlight>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Withdraw to Bank</h2>
          </div>

          {/* Razorpay notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Razorpay Integration Coming Soon
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Bank withdrawals will be enabled once Razorpay payout integration is live.
                Your balance is safe and will be fully transferable.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="number"
              min={1}
              max={balance}
              placeholder="Enter amount to withdraw"
              className="input-clean flex-1"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className="btn-primary px-6 opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              {withdrawing ? "Processing…" : "Withdraw"}
            </button>
          </div>

          {message && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
              {message}
            </div>
          )}
        </div>
      </MagicBentoCard>

      {/* How it works */}
      <MagicBentoCard enableParticles={false}>
        <div className="p-6 space-y-3">
          <h3 className="font-semibold text-foreground">How Earnings Work</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1.</strong> A user books a slot at your station and pays with EV Points.
            </p>
            <p>
              <strong className="text-foreground">2.</strong> 80% of the booking amount is credited to your host wallet instantly.
            </p>
            <p>
              <strong className="text-foreground">3.</strong> 20% is retained by Evora as a platform fee.
            </p>
            <p>
              <strong className="text-foreground">4.</strong> Once Razorpay is integrated, you can withdraw your balance directly to your bank account.
            </p>
          </div>
        </div>
      </MagicBentoCard>
    </div>
  )
}

export default HostWalletPage
