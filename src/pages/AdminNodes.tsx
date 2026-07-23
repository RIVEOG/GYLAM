import { useEffect, useState } from 'react';
import { Plus, HardDrive, Trash2, Power, Edit2, MapPin, Cpu, MemoryStick } from 'lucide-react';
import { fetchNodes, createNode, updateNode, deleteNode } from '@/lib/db';
import type { Node } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { formatBytes, nodeStatusColor } from '@/lib/utils';

interface EditState {
  id?: string;
  name: string;
  ip_assigned: string;
  status: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
  location: string;
}

const EMPTY: EditState = {
  name: '',
  ip_assigned: '',
  status: 'offline',
  ram_total_mb: 4096,
  disk_total_mb: 20480,
  cpu_total_percent: 200,
  location: '',
};

export function AdminNodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchNodes()
      .then(setNodes)
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateNode(editing.id, {
          name: editing.name,
          ip_assigned: editing.ip_assigned,
          status: editing.status as Node['status'],
          ram_total_mb: editing.ram_total_mb,
          disk_total_mb: editing.disk_total_mb,
          cpu_total_percent: editing.cpu_total_percent,
          location: editing.location,
        });
      } else {
        await createNode({
          name: editing.name,
          ip_assigned: editing.ip_assigned,
          status: editing.status as Node['status'],
          ram_total_mb: editing.ram_total_mb,
          disk_total_mb: editing.disk_total_mb,
          cpu_total_percent: editing.cpu_total_percent,
          location: editing.location,
        });
      }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (n: Node) => {
    await updateNode(n.id, { status: n.status === 'online' ? 'offline' : 'online' });
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await deleteNode(confirmDelete.id);
    setConfirmDelete(null);
    load();
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{nodes.length} node{nodes.length === 1 ? '' : 's'}</p>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={16} /> Add Node
        </Button>
      </div>

      {nodes.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <HardDrive size={28} className="text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-300">No nodes configured</p>
            <p className="text-xs text-slate-500">Add a compute node so users can create servers.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {nodes.map((n) => {
            const sc = nodeStatusColor(n.status);
            return (
              <Card key={n.id} hover>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${sc.bg}`}>
                        <HardDrive size={20} className={sc.text} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{n.name}</p>
                        <p className="text-xs text-slate-500">{n.ip_assigned}</p>
                      </div>
                    </div>
                    <Badge bg={sc.bg} text={sc.text} dot={sc.dot}>{n.status}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <MemoryStick size={14} className="mx-auto mb-1 text-amber-400" />
                      <p className="text-xs text-slate-500">RAM</p>
                      <p className="text-sm font-medium text-slate-200">{formatBytes(n.ram_total_mb)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <HardDrive size={14} className="mx-auto mb-1 text-sky-400" />
                      <p className="text-xs text-slate-500">Disk</p>
                      <p className="text-sm font-medium text-slate-200">{formatBytes(n.disk_total_mb)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 py-2">
                      <Cpu size={14} className="mx-auto mb-1 text-blue-400" />
                      <p className="text-xs text-slate-500">CPU</p>
                      <p className="text-sm font-medium text-slate-200">{n.cpu_total_percent}%</p>
                    </div>
                  </div>

                  {n.location && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} /> {n.location}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => toggleStatus(n)}>
                      <Power size={14} /> {n.status === 'online' ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: n.id, name: n.name, ip_assigned: n.ip_assigned, status: n.status, ram_total_mb: n.ram_total_mb, disk_total_mb: n.disk_total_mb, cpu_total_percent: n.cpu_total_percent, location: n.location ?? '' })}>
                      <Edit2 size={14} /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-red-400 hover:bg-red-500/10" onClick={() => setConfirmDelete(n)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / create modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Node' : 'Add Node'} size="md">
        {editing && (
          <div className="space-y-4">
            <Input label="Node Name" name="nodename" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Node US-1" />
            <Input label="IP / Domain" name="nodeip" value={editing.ip_assigned} onChange={(e) => setEditing({ ...editing, ip_assigned: e.target.value })} placeholder="node1.example.com" />
            <Input label="Location" name="nodelocation" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="New York, US" />
            <div className="grid grid-cols-3 gap-3">
              <Input label="RAM (MB)" name="noderam" type="number" value={editing.ram_total_mb} onChange={(e) => setEditing({ ...editing, ram_total_mb: Number(e.target.value) })} />
              <Input label="Disk (MB)" name="nodedisk" type="number" value={editing.disk_total_mb} onChange={(e) => setEditing({ ...editing, disk_total_mb: Number(e.target.value) })} />
              <Input label="CPU (%)" name="nodecpu" type="number" value={editing.cpu_total_percent} onChange={(e) => setEditing({ ...editing, cpu_total_percent: Number(e.target.value) })} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Status</span>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              >
                <option value="offline">Offline</option>
                <option value="online">Online</option>
              </select>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving || !editing.name || !editing.ip_assigned}>
                {saving ? <Spinner size={14} /> : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete node" size="sm">
        <p className="text-sm text-slate-400">
          Delete <span className="font-semibold text-slate-200">{confirmDelete?.name}</span>? Servers attached to it will lose their node assignment.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={doDelete}><Trash2 size={14} /> Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
