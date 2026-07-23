import { useAuth } from '@/lib/auth';
import { Server, Cpu, MemoryStick, HardDrive, Users } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();
  const stats = [
    { label: 'Servers', value: 0, icon: Server, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'CPU Usage', value: '0%', icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Memory', value: '0 GB', icon: MemoryStick, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Storage', value: '0 GB', icon: HardDrive, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-100">Welcome back, {user?.username}</h1><p className="text-sm text-slate-500">Here's your Gylam Panel overview.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5"><div className="flex items-center justify-between">
            <div><p className="text-xs text-slate-500">{s.label}</p><p className="mt-1 text-2xl font-bold text-slate-100">{s.value}</p></div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}><s.icon size={20} className={s.color} /></div>
          </div></div>
        ))}
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-2"><Users size={18} className="text-slate-500" /><h2 className="text-lg font-semibold text-slate-200">Your Servers</h2></div>
        <div className="mt-4 flex flex-col items-center justify-center py-12 text-center">
          <Server size={32} className="mb-3 text-slate-700" /><p className="text-sm text-slate-400">No servers yet</p><p className="text-xs text-slate-600">Create your first game server to get started.</p>
        </div>
      </div>
    </div>
  );
}
