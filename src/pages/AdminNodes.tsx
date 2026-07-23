import { useEffect, useState } from 'react';
import { HardDrive, Plus, MapPin, Cpu, MemoryStick, Power, Trash2, Terminal, KeyRound, Copy, Check, X } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  ip_assigned: string;
  status: 'online' | 'offline';
  location?: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
}

export function AdminNodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [connectNode, setConnectNode] = useState<Node | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Node | null>(null);
  const [copied, setCopied] = useState(false);

  // add form state
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [location, setLocation] = useState('');
  const [ram, setRam] = useState(4096);
  const [disk, setDisk] = useState(20480);
  const [cpu, setCpu] = useState(200);

  // nodes stored in localStorage for now (demo)
  useEffect(() => {
    const stored = localStorage.getItem('gylam_nodes');
    if (stored) setNodes(JSON.parse(stored));
  }, []);

  const saveNodes = (n: Node[]) => {
    setNodes(n);
    localStorage.setItem('gylam_nodes', JSON.stringify(n));
  };

  const addNode = () => {
    const node: Node = {
      id: crypto.randomUUID(),
      name,
      ip_assigned: ip,
      status: 'offline',
      location,
      ram_total_mb: ram,
      disk_total_mb: disk,
      cpu_total_percent: cpu,
    };
    saveNodes([...nodes, node]);
    setShowAdd(false);
    setName(''); setIp(''); setLocation(''); setRam(4096); setDisk(20480); setCpu(200);
  };

  const toggleStatus = (n: Node) => {
    saveNodes(nodes.map((x) => (x.id === n.id ? { ...x, status: x.status === 'online' ? 'offline' : 'online' } : x)));
  };

  const deleteNode = () => {
    if (!confirmDelete) return;
    saveNodes(nodes.filter((x) => x.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (s: string) =>
    s === 'online' ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' } : { bg: 'bg-slate-700/30', text: 'text-slate-400', dot: 'bg-slate-500' };

  const formatMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Nodes</h1>
          <p className="text-sm text-slate-500">Manage compute nodes and connect new VPS instances.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Node
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <HardDrive size={32} className="text-slate-700" />
          <div>
            <p className="text-sm font-medium text-slate-300">No nodes configured</p>
            <p className="text-xs text-slate-600">Add a compute node, then connect it from the node VPS using install.sh.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {nodes.map((n) => {
            const sc = statusColor(n.status);
            return (
              <div key={n.id} className="card p-5">
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
                  <span className={`inline-flex items-center gap-1.5 rounded-full ${sc.bg} px-2.5 py-0.5 text-xs font-medium ${sc.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} /> {n.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-800/40 py-2">
                    <MemoryStick size={14} className="mx-auto mb-1 text-amber-400" />
                    <p className="text-xs text-slate-500">RAM</p>
                    <p className="text-sm font-medium text-slate-200">{formatMB(n.ram_total_mb)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/40 py-2">
                    <HardDrive size={14} className="mx-auto mb-1 text-sky-400" />
                    <p className="text-xs text-slate-500">Disk</p>
                    <p className="text-sm font-medium text-slate-200">{formatMB(n.disk_total_mb)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/40 py-2">
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn btn-secondary text-xs" onClick={() => toggleStatus(n)}>
                    <Power size={14} /> {n.status === 'online' ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-ghost text-xs" onClick={() => setConnectNode(n)}>
                    <Terminal size={14} /> Connect
                  </button>
                  <button className="btn btn-ghost ml-auto text-xs text-red-400 hover:bg-red-500/10" onClick={() => setConfirmDelete(n)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Node Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAdd(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Add Node</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1 text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Node Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Node US-1" />
              </div>
              <div>
                <label className="label">IP / Domain</label>
                <input className="input" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="node1.example.com" />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="New York, US" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">RAM (MB)</label>
                  <input className="input" type="number" value={ram} onChange={(e) => setRam(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Disk (MB)</label>
                  <input className="input" type="number" value={disk} onChange={(e) => setDisk(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">CPU (%)</label>
                  <input className="input" type="number" value={cpu} onChange={(e) => setCpu(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addNode} disabled={!name || !ip}>Add Node</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Node Modal */}
      {connectNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConnectNode(null)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Connect Node: {connectNode.name}</h3>
              <button onClick={() => setConnectNode(null)} className="rounded-lg p-1 text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-slate-300">
                Run the installer on your node VPS to connect it to this panel. The node agent will use the Node ID below to authenticate.
              </div>
              <div>
                <label className="label">Node ID</label>
                <div className="flex items-center gap-2">
                  <code className="block flex-1 truncate rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300">{connectNode.id}</code>
                  <button className="btn btn-secondary text-xs" onClick={() => copyText(connectNode.id)}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><KeyRound size={12} /> Node Token</label>
                <p className="text-xs text-slate-500">Generated automatically when the node agent first connects. Use the Node ID in install.sh on the node VPS.</p>
              </div>
              <div>
                <label className="label">On the node VPS, run:</label>
                <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-slate-300">
{`bash install.sh install-node
# Paste the Node ID above when prompted`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Delete node?</h3>
            <p className="mt-2 text-sm text-slate-400">Delete <span className="font-semibold text-slate-200">{confirmDelete.name}</span>?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteNode}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
