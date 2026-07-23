import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type SafeUser } from './api';

interface AuthCtx {
  user: SafeUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gylam_token');
    if (!token) { setLoading(false); return; }
    api.me().then(({ user }) => setUser(user)).catch(() => localStorage.removeItem('gylam_token')).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user, token } = await api.login(email, password);
    localStorage.setItem('gylam_token', token); setUser(user);
  };
  const register = async (username: string, email: string, password: string) => {
    const { user, token } = await api.register(username, email, password);
    localStorage.setItem('gylam_token', token); setUser(user);
  };
  const logout = () => { localStorage.removeItem('gylam_token'); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
