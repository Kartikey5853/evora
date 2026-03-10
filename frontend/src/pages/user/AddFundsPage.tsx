import { useState, useEffect } from "react"
import { Wallet, Plus, ArrowDownRight, ArrowUpRight, CreditCard, AlertCircle } from "lucide-react"
import { walletAPI } from "@/lib/api"
import MagicBentoCard from "@/components/ui/MagicBentoCard"

interface WalletTxn {
  id: string
  type: string
  amount: number
  description: string | null
  created_at: string
}

const presets = [100, 250, 500, 1000, 2500, 5000]

const AddFundsPage = () => {
  const [balance, setBalance] = useState<number>(0)
  const [txns, setTxns] = useState<WalletTxn[]>([])
  const [amount, setAmount] = useState<number>(500)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoadingData(true)
    try {
      const [bRes, tRes] = await Promise.all([walletAPI.getBalance(), walletAPI.getTransactions()])
      setBalance(bRes.data.balance ?? 0)
      setTxns(tRes.data ?? [])
    } catch {
    } finally {
      setLoadingData(false)
    }
  }

  const handleAddFunds = async () => {
    if (amount <= 0) return
    setLoading(true)
    try {
      const res = await walletAPI.addFunds(amount)
      setBalance(res.data.balance)
      await fetchData()
      setAmount(500)
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to add funds")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-8 animate-fade-in">
      {/* Balance card */}
      <MagicBentoCard enableParticles enableSpotlight className="!border-primary/20">
        <div className="rounded-2xl gradient-primary p-8 text-primary-foreground">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-7 h-7" />
            <h1 className="text-xl font-semibold">EV Points Wallet</h1>
          </div>
          <p className="text-sm opacity-80 mb-1">Available Balance</p>
          <p className="text-4xl font-bold tracking-tight">
            {loadingData ? "..." : `${balance.toFixed(2)}`}
            <span className="text-lg ml-2 font-normal opacity-80">EV Points</span>
          </p>
          <p className="text-xs mt-2 opacity-70">1 EV Point = 1 Rupee</p>
        </div>
      </MagicBentoCard>

      {/* Add funds */}
      <MagicBentoCard enableParticles={false} enableSpotlight>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Add EV Points</h2>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                  amount === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-center">
            <input
              type="number"
              min={1}
              max={50000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input-clean flex-1 text-lg font-medium"
            />
            <button
              onClick={handleAddFunds}
              disabled={loading || amount <= 0}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Points"}
            </button>
          </div>

          {/* Razorpay note */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Razorpay Integration Coming Soon</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Real payment gateway integration is in progress. For now, points are added instantly for testing.
              </p>
            </div>
          </div>
        </div>
      </MagicBentoCard>

      {/* Transaction history */}
      <MagicBentoCard enableParticles={false} enableSpotlight>
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Transaction History</h2>

          {loadingData ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : txns.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    t.type === "CREDIT" ? "bg-accent" : "bg-red-100"
                  }`}>
                    {t.type === "CREDIT" ? (
                      <ArrowDownRight className="w-4 h-4 text-primary" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description || t.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    t.type === "CREDIT" ? "text-primary" : "text-red-600"
                  }`}>
                    {t.type === "CREDIT" ? "+" : "-"}{t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </MagicBentoCard>
    </div>
  )
}

export default AddFundsPage
