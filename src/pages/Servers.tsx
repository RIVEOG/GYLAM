import { useEffect, useState } from 'react';
import { Server as ServerIcon, Plus, Search, Trash2, Power, RotateCw } from 'lucide-react';
import { fetchServers, updateServerStatus, deleteServer } from '@/lib/db';
import type { Server } from '@/lib/types';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { statusColor, formatBytes, timeAgo } from '@/lib/utils';

interface ServersProps {
  onNavigate: (page: string) => void;
  onOpenServer: (id: string) => void;
}

export function Servers({ onNavigate, onOpenServer }: ServersProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Server | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    fetchServers()
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = servers.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const togglePower = async (s: Server) => {
    setBusy(s.id);
    try {
      if (s.status === 'running') {
        await updateServerStatus(s.id, 'stopping');
        setTimeout(() => updateServerStatus(s.id, 'offline'), 800);
      } else {
        await updateServerStatus(s.id, 'starting');
        setTimeout(() => updateServerStatus(s.id, 'running'), 1200);
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(confirmDelete.id);
    try {
      await deleteServer(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          name="search"
          placeholder="Search servers..."
          icon={<Search size={16} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:w-72"
        />
        <Button onClick={() => onNavigate('create')}>
          <Plus size={16} /> Create Server
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800">
            <ServerIcon size={26} className="text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">{query ? 'No matches' : 'No servers yet'}</p>
            <p className="text-xs text-slate-500">{query ? 'Try a different search.' : 'Create your first server to begin.'}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const sc = statusColor(s.status);
            return (
              <Card key={s.id} hover className="overflow-hidden">
                <button onClick={() => onOpenServer(s.id)} className="block w-full p-5 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${sc.bg}`}>
                        <ServerIcon size={20} className={sc.text} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{s.name}</p>
                        <p className="text-xs capitalize text-slate-500">{s.template_name}</p>
                      </div>
                    </div>
                    <Badge bg={sc.bg} text={sc.text} dot={sc.dot}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <p className="text-xs text-slate-500">RAM</p>
                      <p className="text-sm font-medium text-slate-200">{formatBytes(s.ram_mb)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <p className="text-xs text-slate-500">CPU</p>
                      <p className="text-sm font-medium text-slate-200">{s.cpu_percent}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <p className="text-xs text-slate-500">Port</p>
                      <p className="text-sm font-medium text-slate-200">:{s.port}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">Created {timeAgo(s.created_at)}</p>
                </button>
                <div className="flex border-t border-slate-800">
                  <button
                    onClick={() => togglePower(s)}
                    disabled={busy === s.id}
                    className="flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 disabled:opacity-50"
                  >
                    <Power size={14} /> {s.status === 'running' ? 'Stop' : 'Start'}
                  </button>
                  <div className="w-px bg-slate-800" />
                  <button
                    onClick={() => setConfirmDelete(s)}
                    className="flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete server" size="sm">
        <p className="text-sm text-slate-400">
          Are you sure you want to delete <span className="font-semibold text-slate-200">{confirmDelete?.name}</span>? This will permanently
          remove the server, its plugins, properties, and logs. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={doDelete} disabled={busy === confirmDelete?.id}>
            {busy === confirmDelete?.id ? <Spinner size={14} /> : <><Trash2 size={14} /> Delete</>}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
