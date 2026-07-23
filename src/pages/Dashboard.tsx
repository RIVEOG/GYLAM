import { useEffect, useState } from 'react';
import { Server as ServerIcon, Cpu, MemoryStick, HardDrive, Plus, Activity } from 'lucide-react';
import { fetchServers } from '@/lib/db';
import type { Server } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { Spinner } from '@/components/Spinner';
import { statusColor, formatBytes, timeAgo } from '@/lib/utils';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onOpenServer: (id: string) => void;
}

export function Dashboard({ onNavigate, onOpenServer }: DashboardProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers()
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  }, []);

  const running = servers.filter((s) => s.status === 'running').length;
  const totalRam = servers.reduce((a, s) => a + s.ram_mb, 0);
  const totalCpu = servers.reduce((a, s) => a + s.cpu_percent, 0);
  const totalDisk = servers.reduce((a, s) => a + s.disk_mb, 0);

  const stats = [
    { label: 'Total Servers', value: servers.length, icon: ServerIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Running', value: running, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Allocated RAM', value: formatBytes(totalRam), icon: MemoryStick, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Allocated CPU', value: `${totalCpu}%`, icon: Cpu, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon size={20} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-semibold text-slate-100">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Disk usage overview */}
      <Card>
        <CardHeader title="Resource Allocation" subtitle="Across all your servers" />
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-400">Memory</span>
              <span className="text-slate-500">{formatBytes(totalRam)}</span>
            </div>
            <ProgressBar value={Math.min(100, totalRam / 50)} color="bg-amber-500" />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-400">Disk</span>
              <span className="text-slate-500">{formatBytes(totalDisk)}</span>
            </div>
            <ProgressBar value={Math.min(100, totalDisk / 100)} color="bg-sky-500" />
          </div>
        </div>
      </Card>

      {/* Servers list */}
      <Card>
        <CardHeader
          title="Your Servers"
          subtitle={`${servers.length} server${servers.length === 1 ? '' : 's'}`}
          action={
            <Button size="sm" onClick={() => onNavigate('create')}>
              <Plus size={14} /> New
            </Button>
          }
        />
        {servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800">
              <ServerIcon size={26} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">No servers yet</p>
              <p className="text-xs text-slate-500">Create your first game server to get started.</p>
            </div>
            <Button size="sm" onClick={() => onNavigate('create')}>
              <Plus size={14} /> Create Server
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {servers.map((s) => {
              const sc = statusColor(s.status);
              return (
                <button
                  key={s.id}
                  onClick={() => onOpenServer(s.id)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-800/40"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${sc.bg}`}>
                    <ServerIcon size={18} className={sc.text} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {s.template_name} · {formatBytes(s.ram_mb)} RAM · :{s.port} · {timeAgo(s.created_at)}
                    </p>
                  </div>
                  <Badge bg={sc.bg} text={sc.text} dot={sc.dot}>
                    {s.status}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
