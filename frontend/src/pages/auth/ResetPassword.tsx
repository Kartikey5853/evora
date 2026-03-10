import { useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, KeyRound } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { authAPI } from '../../lib/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const emailFromQuery = params.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = useMemo(() => !!email && !!otp && newPassword.length >= 6, [email, otp, newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await authAPI.resetPassword({ email, otp, new_password: newPassword });
      navigate('/login');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Enter the OTP you received and choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Email <span className="text-destructive">*</span>
          </label>
          <input className="input-clean" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            OTP <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="input-clean pl-10" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" inputMode="numeric" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            New Password <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="input-clean pl-10" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
          </div>
        </div>

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : 'Reset password'}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-1">
          <Link to="/login" className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2">Back to login</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
