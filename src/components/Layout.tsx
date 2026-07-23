import { type ReactNode, useState } from 'react';
import {
  LayoutGrid,
  Server as ServerIcon,
  Plus,
  Shield,
  Users,
  HardDrive,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface NavItem {
  label: string;
  icon: typeof LayoutGrid;
  page: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, page: 'dashboard' },
  { label: 'Servers', icon: ServerIcon, page: 'servers' },
  { label: 'Create Server', icon: Plus, page: 'create' },
  { label: 'Account', icon: UserCog, page: 'account' },
  { label: 'Admin · Users', icon: Users, page: 'admin-users', adminOnly: true },
  { label: 'Admin · Nodes', icon: HardDrive, page: 'admin-nodes', adminOnly: true },
  { label: 'Admin · Servers', icon: Shield, page: 'admin-servers', adminOnly: true },
  { label: 'Admin · Settings', icon: SettingsIcon, page: 'admin-settings', adminOnly: true },
];

interface LayoutProps {
  page: string;
  onNavigate: (page: string) => void;
  panelName: string;
  children: ReactNode;
}

export function Layout({ page, onNavigate, panelName, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = NAV.filter((n) => !n.adminOnly || profile?.is_admin);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOut();
  };

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/30">
          <svg viewBox="0 0 64 64" className="h-6 w-6">
            <path d="M32 12 L50 22 L50 42 L32 52 L14 42 L14 22 Z" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinejoin="round" />
            <path d="M32 12 L32 32 L14 22 M32 32 L50 22 M32 32 L32 52" stroke="#93c5fd" strokeWidth="2" fill="none" opacity="0.6" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{panelName}</p>
          <p className="text-xs text-slate-500">Game Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active = page === item.page;
          return (
            <button
              key={item.page}
              onClick={() => {
                onNavigate(item.page);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <item.icon size={18} className={active ? 'text-blue-400' : 'text-slate-500'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: profile?.avatar_color || '#3b82f6' }}
          >
            {profile ? initials(profile.username) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{profile?.username}</p>
            <p className="truncate text-xs text-slate-500">{profile?.is_admin ? 'Administrator' : 'User'}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-900/80 backdrop-blur-md lg:block">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-900">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-slate-500">
              <X size={20} />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden">
            <Menu size={20} />
          </button>
          <h1 className="text-base font-semibold text-slate-100">
            {NAV.find((n) => n.page === page)?.label ?? 'Dashboard'}
          </h1>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
