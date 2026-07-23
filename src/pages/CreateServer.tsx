import { useEffect, useState, type FormEvent } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { fetchTemplates, fetchOnlineNodes, fetchSettings, createServer } from '@/lib/db';
import type { Template, Node, Settings } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Input, Select } from '@/components/Input';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Spinner } from '@/components/Spinner';
import { formatBytes, clamp } from '@/lib/utils';

interface CreateServerProps {
  onNavigate: (page: string) => void;
  onCreated: (id: string) => void;
}

export function CreateServer({ onNavigate, onCreated }: CreateServerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [ram, setRam] = useState(2048);
  const [disk, setDisk] = useState(5120);
  const [cpu, setCpu] = useState(100);
  const [port, setPort] = useState(25565);
  const [motd, setMotd] = useState('A Minecraft Server');
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [version, setVersion] = useState('latest');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, n, s] = await Promise.all([fetchTemplates(), fetchOnlineNodes(), fetchSettings()]);
        setTemplates(t);
        setNodes(n);
        setSettings(s);
        if (t[0]) selectTemplate(t[0]);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectTemplate = (t: Template) => {
    setSelectedTpl(t);
    setRam(t.default_ram_mb);
    setDisk(t.default_disk_mb);
    setCpu(t.default_cpu_percent);
    setPort(t.default_port);
  };

  const freeEnabled = settings?.free_servers_enabled ?? true;
  const maxRam = settings?.free_ram_mb ?? 2048;
  const maxDisk = settings?.free_disk_mb ?? 5120;
  const maxCpu = settings?.free_cpu_percent ?? 100;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedTpl) {
      setError('Pick a template first.');
      return;
    }
    if (!name.trim()) {
      setError('Server name is required.');
      return;
    }
    if (nodes.length === 0) {
      setError('No online nodes available. An admin must add and enable a node first.');
      return;
    }
    if (freeEnabled) {
      if (ram > maxRam) return setError(`Free servers are limited to ${formatBytes(maxRam)} RAM.`);
      if (disk > maxDisk) return setError(`Free servers are limited to ${formatBytes(maxDisk)} disk.`);
      if (cpu > maxCpu) return setError(`Free servers are limited to ${maxCpu}% CPU.`);
    }
    setSubmitting(true);
    try {
      const server = await createServer({
        name: name.trim(),
        template_id: selectedTpl.id,
        template_name: selectedTpl.name,
        node_id: nodeId || nodes[0]?.id || null,
        ram_mb: ram,
        disk_mb: disk,
        cpu_percent: cpu,
        port,
        motd: motd.trim(),
        max_players: maxPlayers,
        version: version.trim() || 'latest',
        is_free: freeEnabled,
      });
      onCreated(server.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server.');
    } finally {
      setSubmitting(false);
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
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={() => onNavigate('servers')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={16} /> Back to servers
      </button>

      {nodes.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertCircle size={16} />
          No compute nodes are online. An administrator must add a node and set it online before servers can be created.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Templates */}
        <Card>
          <CardHeader title="Choose a Template" subtitle="Built-in server templates" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[t.icon] || Icons.Box;
              const active = selectedTpl?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    active ? 'border-blue-500 bg-blue-600/10 ring-1 ring-blue-500/30' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                      <Icon size={18} className={active ? 'text-blue-400' : 'text-slate-400'} />
                    </div>
                    {active && <Check size={16} className="text-blue-400" />}
                  </div>
                  <p className="text-sm font-medium text-slate-200">{t.display_name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Badge>{formatBytes(t.default_ram_mb)}</Badge>
                    <Badge>{t.default_cpu_percent}% CPU</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader title="Server Configuration" subtitle="Name, node, and resources" />
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Server Name" name="name" required placeholder="My Awesome Server" value={name} onChange={(e) => setName(e.target.value)} />
              <Select label="Compute Node" name="node" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                {nodes.length === 0 && <option value="">No nodes available</option>}
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} — {n.ip_assigned}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="MOTD" name="motd" placeholder="A Minecraft Server" value={motd} onChange={(e) => setMotd(e.target.value)} />
              <Input label="Version" name="version" placeholder="latest" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Port" name="port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} />
              <Input label="Max Players" name="maxplayers" type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} />
              <Input label="CPU %" name="cpu" type="number" min={10} max={freeEnabled ? maxCpu : 400} value={cpu} onChange={(e) => setCpu(clamp(Number(e.target.value), 10, freeEnabled ? maxCpu : 400))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label={`Memory (MB)${freeEnabled ? ` — max ${maxRam}` : ''}`}
                  name="ram"
                  type="number"
                  min={512}
                  max={freeEnabled ? maxRam : 16384}
                  step={512}
                  value={ram}
                  onChange={(e) => setRam(clamp(Number(e.target.value), 512, freeEnabled ? maxRam : 16384))}
                />
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(ram / (freeEnabled ? maxRam : 16384)) * 100}%` }} />
                </div>
              </div>
              <div>
                <Input
                  label={`Disk (MB)${freeEnabled ? ` — max ${maxDisk}` : ''}`}
                  name="disk"
                  type="number"
                  min={512}
                  max={freeEnabled ? maxDisk : 51200}
                  step={512}
                  value={disk}
                  onChange={(e) => setDisk(clamp(Number(e.target.value), 512, freeEnabled ? maxDisk : 51200))}
                />
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(disk / (freeEnabled ? maxDisk : 51200)) * 100}%` }} />
                </div>
              </div>
            </div>

            {freeEnabled && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-400">
                Free servers are enabled. Resources are capped at {formatBytes(maxRam)} RAM, {formatBytes(maxDisk)} disk, and {maxCpu}% CPU per server.
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onNavigate('servers')}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={submitting || nodes.length === 0}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Create Server
          </Button>
        </div>
      </form>
    </div>
  );
}
