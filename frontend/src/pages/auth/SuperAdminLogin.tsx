import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShieldAlert, Mail, Lock, Eye, EyeOff } from "lucide-react"
import AuthLayout from "../../components/layout/AuthLayout"
import { superadminAPI } from "@/lib/api"

const SuperAdminLogin = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [formData, setFormData] = useState({ email: "", password: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await superadminAPI.login(formData)
      localStorage.setItem("access_token", res.data.access_token)
      localStorage.setItem("user_type", "superadmin")
      navigate("/superadmin/dashboard")
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Invalid superadmin credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Superadmin Portal"
      subtitle="Authorized personnel only"
    >
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-600" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              required
              className="input pl-10"
              placeholder="superadmin@evora.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              required
              className="input pl-10 pr-10"
              placeholder="••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition"
        >
          {loading ? "Authenticating…" : "Sign In as Superadmin"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => navigate("/admin/login")}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to Admin Login
        </button>
      </div>
    </AuthLayout>
  )
}

export default SuperAdminLogin
