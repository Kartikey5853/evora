import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../ui/Logo';
import LightPillar from '../ui/LightPillar';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  const location = useLocation();

  const isAdmin = location.pathname.startsWith('/admin');
  const backTo = isAdmin ? '/admin/login' : '/login';
  const showBack =
    location.pathname !== '/login' && location.pathname !== '/admin/login';

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Left: LightPillar hero panel (hidden on mobile) ─── */}
      <div className="hidden lg:flex relative w-[55%] overflow-hidden bg-black items-end">
        <LightPillar
          topColor="#73E6CB"
          bottomColor="#00674F"
          intensity={0.9}
          rotationSpeed={0.25}
          glowAmount={0.004}
          pillarWidth={2.8}
          pillarHeight={0.35}
          noiseIntensity={0.4}
          quality="high"
          mixBlendMode="screen"
        />

        {showBack && (
          <Link
            to={backTo}
            className="absolute top-6 left-6 z-20 flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        )}

        <div className="relative z-10 p-10 pb-12 w-full">
          <h2 className="text-white text-2xl md:text-3xl font-display font-semibold leading-snug">
            Charge <span className="font-bold">smarter</span>,
            <br />
            drive <span className="font-bold">further</span>
          </h2>
          <p className="text-white/60 text-sm mt-3 max-w-sm">
            Find EV stations, book slots, and manage your charging — all in one place.
          </p>
        </div>
      </div>

      {/* ─── Right: Form panel ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-center lg:justify-end px-8 pt-8">
          <Logo size="md" />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[420px] space-y-8">
            {showBack && (
              <Link
                to={backTo}
                className="lg:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mt-2 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            )}

            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">{title}</h1>
              <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            </div>

            {children}
          </div>
        </div>

        <div className="px-8 pb-6 text-center lg:text-right">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Evora</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
