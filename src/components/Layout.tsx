import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Users, HardDrive, LogOut, Gamepad2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  return (
    <div className="flex h-screen bg-slate-950">
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-3 border-b border-slate-800 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Gamepad2 size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Gylam Panel</p>
            <p className="text-xs text-slate-500">Game Server Management</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          {user?.is_admin && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Admin</p>
              <NavLink to="/admin/users" className={linkClass}>
                <Users size={18} /> Users
              </NavLink>
              <NavLink to="/admin/nodes" className={linkClass}>
                <HardDrive size={18} /> Nodes
              </NavLink>
            </>
          )}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{user?.username}</p>
              <p className="truncate text-xs text-slate-500">{user?.is_admin ? 'Administrator' : 'User'}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400">
              <LogOut size={16} />
            </button>
          </div>
          <p className="mt-2 px-2 text-center text-[10px] text-slate-600">Gylam Panel · Made with Nethost Team</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
