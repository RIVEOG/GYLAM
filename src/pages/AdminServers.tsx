import { useEffect, useState } from 'react';
import { Server as ServerIcon, Search, Trash2, Power } from 'lucide-react';
import { fetchServers, deleteServer, updateServerStatus } from '@/lib/db';
import type { Server } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { statusColor, formatBytes } from '@/lib/utils';

interface AdminServersProps {
  onOpenServer: (id: string) => void;
}

export function AdminServers({ onOpenServer }: AdminServersProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Server | null>(null);

  const load = () => {
    fetchServers()
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const togglePower = async (s: Server) => {
    if (s.status === 'running') {
      await updateServerStatus(s.id, 'stopping');
      setTimeout(() => updateServerStatus(s.id, 'offline'), 800);
    } else {
      await updateServerStatus(s.id, 'starting');
      setTimeout(() => updateServerStatus(s.id, 'running'), 1200);
    }
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await deleteServer(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  const filtered = servers.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        name="adminserversearch"
        placeholder="Search servers..."
        icon={<Search size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="sm:w-72"
      />

      <Card>
        <CardHeader title="All Servers" subtitle={`${servers.length} total across all users`} />
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <ServerIcon size={28} className="text-slate-600" />
            <p className="text-sm text-slate-400">No servers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-5 py-3 text-left font-medium">Server</th>
                  <th className="px-5 py-3 text-left font-medium">Node</th>
                  <th className="px-5 py-3 text-left font-medium">Resources</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((s) => {
                  const sc = statusColor(s.status);
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-5 py-3">
                        <button onClick={() => onOpenServer(s.id)} className="flex items-center gap-3 text-left">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${sc.bg}`}>
                            <ServerIcon size={16} className={sc.text} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-200 hover:text-blue-400">{s.name}</p>
                            <p className="text-xs capitalize text-slate-500">{s.template_name}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{s.node?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {formatBytes(s.ram_mb)} / {formatBytes(s.disk_mb)} / {s.cpu_percent}%
                      </td>
                      <td className="px-5 py-3">
                        <Badge bg={sc.bg} text={sc.text} dot={sc.dot}>{s.status}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => togglePower(s)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300" title="Toggle power">
                            <Power size={15} />
                          </button>
                          <button onClick={() => setConfirmDelete(s)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete server" size="sm">
        <p className="text-sm text-slate-400">
          Permanently delete <span className="font-semibold text-slate-200">{confirmDelete?.name}</span>?
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={doDelete}><Trash2 size={14} /> Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
