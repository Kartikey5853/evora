import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { authAPI } from '../../lib/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Forgot password" subtitle="Enter your email and we'll send you an OTP to reset your password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Email <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-clean pl-10"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        {sent && (
          <div className="rounded-xl bg-accent/50 border border-primary/20 px-4 py-3 text-sm text-foreground">
            If this email exists, an OTP has been sent.{' '}
            <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2">
              Reset now →
            </Link>
          </div>
        )}

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <LoadingSpinner size="sm" /> : 'Send OTP'}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-1">
          <Link to="/login" className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2">Back to login</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
