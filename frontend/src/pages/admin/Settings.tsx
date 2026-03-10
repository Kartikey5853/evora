import { useEffect, useState } from 'react';
import { useTheme, themes, type ThemeName } from '../../components/ThemeProvider';
import { Palette, Shield } from 'lucide-react';
import MagicBentoCard from '../../components/ui/MagicBentoCard';

const AdminSettings = () => {
  const { theme, setTheme } = useTheme();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(localStorage.getItem('admin_two_factor_enabled') === 'true');

  useEffect(() => {
    localStorage.setItem('admin_two_factor_enabled', String(twoFactorEnabled));
  }, [twoFactorEnabled]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <MagicBentoCard enableParticles={false}>
        <div className="p-6">
          <h1 className="text-xl font-semibold">Admin Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalise your admin experience.</p>
        </div>
      </MagicBentoCard>

      {/* ── Theme Switcher ──────────────────────────────── */}
      <MagicBentoCard enableParticles={false} enableSpotlight>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">Colour Theme</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  theme === t.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full shadow-inner border-2 border-white"
                  style={{ backgroundColor: t.preview }}
                />
                <span className="font-medium text-sm">{t.name}</span>
                <span className="text-[11px] text-muted-foreground leading-tight text-center">{t.description}</span>

                {theme === t.id && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </MagicBentoCard>

      {/* ── Two-factor ──────────────────────────────────── */}
      <MagicBentoCard enableParticles={false}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">Security</h2>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Two-factor authentication (OTP)</p>
              <p className="text-xs text-muted-foreground">
                When enabled, admin login requires an OTP.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Stored locally — backend enforcement coming soon.
          </p>
        </div>
      </MagicBentoCard>
    </div>
  );
};

export default AdminSettings;
