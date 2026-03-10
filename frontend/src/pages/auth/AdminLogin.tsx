import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminAuthAPI } from '../../lib/api';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const twoFactorEnabled = localStorage.getItem('admin_two_factor_enabled') !== 'false';
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (!twoFactorEnabled) {
        const response = await adminAuthAPI.loginDirect(formData);
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('user_type', 'admin');
        navigate('/admin/dashboard');
        return;
      }

      if (step === 'request') {
        await adminAuthAPI.loginRequest(formData);
        setStep('verify');
        return;
      }

      const response = await adminAuthAPI.loginVerify({ email: formData.email, otp });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_type', 'admin');
      navigate('/admin/dashboard');
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.detail || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await adminAuthAPI.googleAuth({ credential });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_type', 'admin');
      navigate('/admin/dashboard');
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.detail || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Admin Portal"
      subtitle={
        twoFactorEnabled
          ? step === 'request'
            ? 'Sign in to manage your EV stations'
            : 'Enter the OTP sent to your email'
          : 'Sign in to manage your EV stations'
      }
    >
      {/* ── Google at the top ── */}
      {googleClientId ? (
        <GoogleSignInButton clientId={googleClientId} onCredential={handleGoogleCredential} className="w-full" />
      ) : (
        <button
          type="button"
          onClick={() => setErrorMsg('Missing VITE_GOOGLE_CLIENT_ID.')}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/60 text-foreground font-medium py-3 px-4 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      )}

      {/* ── Divider ── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-muted-foreground">Or</span>
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 'request' && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-clean pl-10" placeholder="admin@company.com" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input-clean pl-10 pr-11" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        {twoFactorEnabled && step === 'verify' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">OTP</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="input-clean" placeholder="123456" required inputMode="numeric" />
          </div>
        )}

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : twoFactorEnabled ? (step === 'request' ? 'Sign in' : 'Verify OTP') : 'Sign in'}
        </button>

        <div className="flex items-center justify-between text-sm pt-1">
          <p className="text-muted-foreground">
            Need an admin account?{' '}
            <Link to="/admin/register" className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2">Register</Link>
          </p>
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground transition-colors">
            Forgot password?
          </Link>
        </div>

        <div className="pt-3 border-t border-border">
          <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to User Login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default AdminLogin;
