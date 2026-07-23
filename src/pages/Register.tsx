import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Gamepad2, User, Mail, Lock, ArrowRight } from 'lucide-react';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try { await register(username, email, password); navigate('/'); }
    catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600"><Gamepad2 size={28} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-100">Create Account</h1>
          <p className="text-sm text-slate-500">Gylam Panel</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
          <div><label className="label">Username</label>
            <div className="relative"><User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input className="input pl-9" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" /></div></div>
          <div><label className="label">Email</label>
            <div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input className="input pl-9" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div></div>
          <div><label className="label">Password (min 8 chars)</label>
            <div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input className="input pl-9" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div></div>
          <div><label className="label">Confirm Password</label>
            <div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input className="input pl-9" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" /></div></div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : <>Create Account <ArrowRight size={16} /></>}</button>
          <p className="text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">Sign in</Link></p>
        </form>
        <p className="mt-6 text-center text-[10px] text-slate-600">Made with Nethost Team</p>
      </div>
    </div>
  );
}
