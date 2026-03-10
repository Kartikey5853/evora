import { ReactNode, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut,
  Wallet,
  User,
  Settings,
  ChevronDown,
} from 'lucide-react';
import Logo from '../ui/Logo';
import ChatWidget from '../ChatWidget';
import GlassSurface from '../ui/GlassSurface';
import Dock from '../ui/Dock';
import { authAPI, adminAuthAPI, walletAPI } from '../../lib/api';

interface DashboardLayoutProps {
  children: ReactNode;
  userType: 'user' | 'admin' | 'superadmin';
  userName?: string;
}

const DashboardLayout = ({ children, userType, userName = 'User' }: DashboardLayoutProps) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(userName);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [profilePicError, setProfilePicError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (userType === 'user') {
          const res = await authAPI.me();
          if (res.data?.name) setDisplayName(res.data.name);
          if (typeof res.data?.profile_pic_url === 'string') {
            setProfilePicUrl(res.data.profile_pic_url || null);
            setProfilePicError(false);
          }
        }

        if (userType === 'admin') {
          const res = await adminAuthAPI.me();
          if (res.data?.name) setDisplayName(res.data.name);
          if (typeof (res.data as any)?.profile_pic_url === 'string') {
            setProfilePicUrl((res.data as any).profile_pic_url || null);
            setProfilePicError(false);
          }
        }
      } catch {}
    };
    if (userType === 'user' || userType === 'admin') load();
    if (userType === 'superadmin') setDisplayName('Super Admin');
  }, [userType]);

  useEffect(() => {
    setProfilePicError(false);
  }, [profilePicUrl]);

  // Fetch wallet balance for user/admin
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (userType === 'user') {
          const res = await walletAPI.getBalance();
          setWalletBalance(res.data.balance ?? 0);
        } else if (userType === 'admin') {
          const res = await walletAPI.getHostBalance();
          setWalletBalance(res.data.balance ?? 0);
        }
      } catch {}
    };
    if (userType !== 'superadmin') fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [userType]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    if (userType === 'superadmin') navigate('/superadmin/login');
    else navigate(userType === 'admin' ? '/admin/login' : '/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Glass Header ───────────────────────────────────── */}
      <GlassSurface className="sticky top-0 z-40 px-4 lg:px-8 py-3">
        <div className="flex items-center gap-4 mx-auto px-2">
          {/* Logo */}
          <Logo size="sm" />

          <div className="flex-1" />

          {/* System status */}
          <div className="flex items-center gap-2 mr-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Online</span>
          </div>

          {/* Wallet balance */}
          {userType !== 'superadmin' && walletBalance !== null && (
            <button
              onClick={() => navigate(userType === 'admin' ? '/admin/wallet' : '/dashboard/wallet')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                ₹{walletBalance.toFixed(0)}
              </span>
            </button>
          )}

          {/* Profile bubble dropdown */}
          {userType !== 'superadmin' && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-muted/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                  {profilePicUrl && !profilePicError ? (
                    <img
                      src={profilePicUrl}
                      alt="profile"
                      className="w-full h-full object-cover"
                      onError={() => setProfilePicError(true)}
                    />
                  ) : (
                    <span className="font-semibold text-sm text-primary">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-lg py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-border mb-1">
                    <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{userType}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      navigate(userType === 'admin' ? '/admin/profile' : '/dashboard/profile');
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="w-4 h-4 text-muted-foreground" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      navigate(userType === 'admin' ? '/admin/settings' : '/dashboard/settings');
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Settings
                  </button>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Superadmin: simple logout */}
          {userType === 'superadmin' && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      </GlassSurface>

      {/* ── Page content ───────────────────────────────────── */}
      <main className="flex-1 px-6 lg:px-10 py-6 pb-28 mx-auto w-full overflow-auto">
        {children}
      </main>

      {/* ── Bottom Dock ────────────────────────────────────── */}
      <Dock userType={userType} />

      {/* Floating chat widget */}
      {userType !== 'superadmin' && <ChatWidget userType={userType} />}
    </div>
  );
};

export default DashboardLayout;
