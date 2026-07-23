import { useState } from 'react';
import { User, Save, Palette } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { updateProfileUsername, updateAvatarColor } from '@/lib/db';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';
import { initials } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function Account() {
  const { profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [color, setColor] = useState(profile?.avatar_color ?? '#3b82f6');
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savedColor, setSavedColor] = useState(false);

  if (!profile) return null;

  const saveName = async () => {
    setSavingName(true);
    try {
      await updateProfileUsername(profile.id, username.trim());
      await refreshProfile();
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } finally {
      setSavingName(false);
    }
  };

  const saveColor = async (c: string) => {
    setColor(c);
    await updateAvatarColor(profile.id, c);
    await refreshProfile();
    setSavedColor(true);
    setTimeout(() => setSavedColor(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Profile header */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ backgroundColor: color }}>
            {initials(username || profile.username)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{profile.username}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <p className="mt-1 text-xs text-slate-600">
              {profile.is_admin ? 'Administrator' : 'Standard User'} · Joined {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Rename */}
      <Card>
        <CardHeader title="Profile" subtitle="Change your display name" />
        <div className="space-y-4 p-5">
          <Input label="Username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} icon={<User size={16} />} />
          <div className="flex items-center gap-3">
            <Button onClick={saveName} disabled={savingName || !username.trim() || username === profile.username}>
              {savingName ? <Spinner size={14} /> : <><Save size={14} /> Save Name</>}
            </Button>
            {savedName && <span className="text-sm text-emerald-400">Saved!</span>}
          </div>
        </div>
      </Card>

      {/* Avatar color */}
      <Card>
        <CardHeader title="Avatar Color" subtitle="Pick a color for your profile" />
        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => saveColor(c)}
                className={`flex h-10 items-center justify-center rounded-xl transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Palette size={16} className="text-white" />}
              </button>
            ))}
          </div>
          {savedColor && <p className="mt-3 text-sm text-emerald-400">Color updated!</p>}
        </div>
      </Card>
    </div>
  );
}
