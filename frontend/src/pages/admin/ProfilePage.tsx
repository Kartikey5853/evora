import { useEffect, useState, useRef } from 'react';
import { adminAuthAPI, authAPI } from '@/lib/api';
import MagicBentoCard from '@/components/ui/MagicBentoCard';
import { Camera, User, Lock, Mail, Save } from 'lucide-react';

const AdminProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await adminAuthAPI.me();
        setName(me.data?.name || '');
        setEmail(me.data?.email || '');
        setProfilePicUrl(me.data?.profile_pic_url || '');
      } catch (err: any) {
        setStatus({ msg: err?.response?.data?.detail || 'Failed to load profile', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setStatus(null);
    try {
      await adminAuthAPI.updateMe({ name });
      setStatus({ msg: 'Profile saved successfully', type: 'success' });
    } catch (err: any) {
      setStatus({ msg: err?.response?.data?.detail || 'Failed to save profile', type: 'error' });
    }
  };

  const handlePicFile = async (file: File) => {
    setStatus(null);
    try {
      const res = await adminAuthAPI.uploadProfilePicture(file);
      setProfilePicUrl(res.data?.profile_pic_url || '');
      setStatus({ msg: 'Profile picture updated', type: 'success' });
    } catch (err: any) {
      setStatus({ msg: err?.response?.data?.detail || 'Failed to upload profile picture', type: 'error' });
    }
  };

  const changePassword = async () => {
    setStatus(null);
    if (!newPassword || newPassword.length < 6) {
      setStatus({ msg: 'New password must be at least 6 characters', type: 'error' }); return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ msg: 'Passwords do not match', type: 'error' }); return;
    }
    try {
      await authAPI.changePassword({ old_password: currentPassword, new_password: newPassword });
      setStatus({ msg: 'Password changed successfully', type: 'success' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setStatus({ msg: err?.response?.data?.detail || 'Failed to change password', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Status banner */}
      {status && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          status.type === 'success'
            ? 'bg-accent text-primary'
            : 'bg-destructive/10 text-destructive'
        }`}>
          {status.msg}
        </div>
      )}

      {/* ── Avatar + Info Card ─────────────────────────────── */}
      <MagicBentoCard enableParticles enableSpotlight className="!border-primary/15">
        <div className="p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar with upload overlay */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted border-2 border-border flex items-center justify-center">
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePicFile(f); }}
              />
            </div>

            {/* Name + Email */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <p className="text-xs font-medium text-primary uppercase tracking-wider">Host Admin</p>
              <h1 className="text-2xl font-bold text-foreground">{name || 'Admin'}</h1>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{email}</span>
              </div>
            </div>
          </div>
        </div>
      </MagicBentoCard>

      {/* ── Edit Profile ───────────────────────────────────── */}
      <MagicBentoCard enableSpotlight>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Edit Profile</h2>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Display Name</label>
              <input className="input-clean" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Profile Picture</label>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">Click the avatar above to upload from your computer.</p>
                {profilePicUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await adminAuthAPI.removeProfilePicture();
                        setProfilePicUrl('');
                      } catch (err: any) {
                        setStatus({ msg: err?.response?.data?.detail || 'Failed to remove profile picture', type: 'error' });
                      }
                    }}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <button onClick={saveProfile} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Profile
          </button>
        </div>
      </MagicBentoCard>

      {/* ── Change Password ────────────────────────────────── */}
      <MagicBentoCard enableSpotlight>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Change Password</h2>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Current Password</label>
              <input type="password" className="input-clean" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">New Password</label>
                <input type="password" className="input-clean" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Confirm New Password</label>
                <input type="password" className="input-clean" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
          </div>

          <button onClick={changePassword} className="btn-primary flex items-center gap-2">
            <Lock className="w-4 h-4" /> Update Password
          </button>
        </div>
      </MagicBentoCard>
    </div>
  );
};

export default AdminProfilePage;
