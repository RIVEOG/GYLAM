import { useState, type FormEvent } from 'react';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Background } from '@/components/Background';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';

interface LoginProps {
  onSwitch: (page: 'register') => void;
  panelName: string;
}

export function Login({ onSwitch, panelName }: LoginProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Background variant="auth">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-500/30">
              <svg viewBox="0 0 64 64" className="h-9 w-9">
                <path d="M32 12 L50 22 L50 42 L32 52 L14 42 L14 22 Z" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinejoin="round" />
                <path d="M32 12 L32 32 L14 22 M32 32 L50 22 M32 32 L32 52" stroke="#93c5fd" strokeWidth="2" fill="none" opacity="0.6" />
                <circle cx="32" cy="32" r="3" fill="#93c5fd" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">{panelName}</h1>
            <p className="mt-1 text-sm text-slate-400">Sign in to your game server panel</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-md">
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <Input
                label="Email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                icon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                icon={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Spinner size={16} /> : <>Sign In <ArrowRight size={16} /></>}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              No account?{' '}
              <button onClick={() => onSwitch('register')} className="font-medium text-blue-400 hover:text-blue-300">
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    </Background>
  );
}
