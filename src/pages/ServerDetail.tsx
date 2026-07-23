import { useEffect, useState, useRef, useCallback } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Power,
  RotateCw,
  Square,
  Cpu,
  MemoryStick,
  HardDrive,
  Globe,
  Network,
  Terminal,
  Package,
  Settings2,
  FileText,
  Trash2,
  Search,
  Send,
  Plus,
  ToggleLeft,
  ToggleRight,
  Save,
  Server as ServerIcon,
  Clock,
} from 'lucide-react';
import { fetchServer, updateServer, updateServerStatus, deleteServer, fetchLogs, sendCommand } from '@/lib/db';
import { fetchPlugins, installPlugin, togglePlugin, deletePlugin, fetchProperties, updateProperty } from '@/lib/db';
import { PLUGIN_CATALOG } from '@/lib/plugins';
import type { Server, Plugin, ServerProperty, LogLine } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { ProgressBar } from '@/components/ProgressBar';
import { Spinner } from '@/components/Spinner';
import { statusColor, formatBytes, formatDateTime, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type Tab = 'overview' | 'console' | 'plugins' | 'properties' | 'settings';

interface ServerDetailProps {
  serverId: string;
  onNavigate: (page: string) => void;
}

export function ServerDetail({ serverId, onNavigate }: ServerDetailProps) {
  const { profile } = useAuth();
  const [server, setServer] = useState<Server | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isAdmin = profile?.is_admin ?? false;

  const load = useCallback(async () => {
    const s = await fetchServer(serverId);
    setServer(s);
    setLoading(false);
  }, [serverId]);

  useEffect(() => {
    load();
  }, [load]);

  const powerToggle = async () => {
    if (!server) return;
    setBusy(true);
    try {
      if (server.status === 'running') {
        await updateServerStatus(server.id, 'stopping');
        setTimeout(async () => {
          await updateServerStatus(server.id, 'offline');
          load();
        }, 800);
      } else {
        await updateServerStatus(server.id, 'starting');
        setTimeout(async () => {
          await updateServerStatus(server.id, 'running');
          load();
        }, 1200);
      }
      load();
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    if (!server) return;
    setBusy(true);
    await updateServerStatus(server.id, 'stopping');
    setTimeout(async () => {
      await updateServerStatus(server.id, 'starting');
      setTimeout(async () => {
        await updateServerStatus(server.id, 'running');
        load();
        setBusy(false);
      }, 1000);
    }, 800);
  };

  const kill = async () => {
    if (!server) return;
    setBusy(true);
    await updateServerStatus(server.id, 'offline');
    load();
    setBusy(false);
  };

  const doDelete = async () => {
    if (!server) return;
    setBusy(true);
    await deleteServer(server.id);
    onNavigate('servers');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (!server) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-400">Server not found or you do not have access.</p>
        <Button className="mt-4" onClick={() => onNavigate('servers')}>
          Back to Servers
        </Button>
      </Card>
    );
  }

  const sc = statusColor(server.status);
  const tabs: { id: Tab; label: string; icon: typeof Terminal }[] = [
    { id: 'overview', label: 'Overview', icon: ServerIcon },
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'plugins', label: 'Plugins', icon: Package },
    { id: 'properties', label: 'Properties', icon: Settings2 },
    { id: 'settings', label: 'Settings', icon: FileText },
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => onNavigate('servers')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft size={16} /> Back to servers
      </button>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${sc.bg}`}>
              <ServerIcon size={22} className={sc.text} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{server.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge bg={sc.bg} text={sc.text} dot={sc.dot}>{server.status}</Badge>
                <span className="capitalize">{server.template_name}</span>
                <span>·</span>
                <span>{server.node?.ip_assigned ?? 'no node'}</span>
                <span>·</span>
                <span>:{server.port}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={server.status === 'running' ? 'danger' : 'success'} onClick={powerToggle} disabled={busy}>
              <Power size={14} /> {server.status === 'running' ? 'Stop' : 'Start'}
            </Button>
            <Button size="sm" variant="secondary" onClick={restart} disabled={busy || server.status !== 'running'}>
              <RotateCw size={14} /> Restart
            </Button>
            <Button size="sm" variant="secondary" onClick={kill} disabled={busy || server.status === 'offline'}>
              <Square size={14} /> Kill
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              tab === t.id ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab server={server} />}
      {tab === 'console' && <ConsoleTab serverId={server.id} canSend={server.status === 'running' || isAdmin} />}
      {tab === 'plugins' && <PluginsTab serverId={server.id} />}
      {tab === 'properties' && <PropertiesTab serverId={server.id} />}
      {tab === 'settings' && (
        <SettingsTab server={server} isAdmin={isAdmin} onDelete={() => setConfirmDelete(true)} />
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete server" size="sm">
        <p className="text-sm text-slate-400">
          Permanently delete <span className="font-semibold text-slate-200">{server.name}</span>? All data is lost.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={doDelete} disabled={busy}>
            {busy ? <Spinner size={14} /> : <><Trash2 size={14} /> Delete</>}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function OverviewTab({ server }: { server: Server }) {
  const stats = [
    { label: 'Memory', value: formatBytes(server.ram_mb), icon: MemoryStick, color: 'text-amber-400', bg: 'bg-amber-500/10', bar: 60 },
    { label: 'Disk', value: formatBytes(server.disk_mb), icon: HardDrive, color: 'text-sky-400', bg: 'bg-sky-500/10', bar: 40 },
    { label: 'CPU', value: `${server.cpu_percent}%`, icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10', bar: server.cpu_percent / 4 },
    { label: 'Players', value: `${server.max_players} max`, icon: Network, color: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: 30 },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Resources" />
        <div className="space-y-4 p-5">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                    <s.icon size={14} className={s.color} />
                  </div>
                  <span className="text-sm text-slate-400">{s.label}</span>
                </div>
                <span className="text-sm font-medium text-slate-200">{s.value}</span>
              </div>
              <ProgressBar value={s.bar} color={s.color.replace('text-', 'bg-')} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Server Info" />
        <div className="divide-y divide-slate-800">
          {[
            { label: 'Template', value: <span className="capitalize">{server.template_name}</span> },
            { label: 'Node', value: server.node?.name ?? 'None' },
            { label: 'Node Address', value: server.node?.ip_assigned ?? '—' },
            { label: 'Port', value: `:${server.port}` },
            { label: 'MOTD', value: server.motd },
            { label: 'Version', value: server.version },
            { label: 'Plan', value: server.is_free ? 'Free' : 'Premium' },
            { label: 'Created', value: formatDateTime(server.created_at) },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span className="text-sm text-slate-200">{row.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Console ---------------- */
function ConsoleTab({ serverId, canSend }: { serverId: string; canSend: boolean }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmd, setCmd] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const l = await fetchLogs(serverId);
    setLogs(l);
    setLoading(false);
  }, [serverId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const onSend = async () => {
    if (!cmd.trim()) return;
    setSending(true);
    try {
      await sendCommand(serverId, cmd);
      setCmd('');
      load();
    } finally {
      setSending(false);
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-amber-400';
      case 'command': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Console"
        subtitle="Live server output"
        action={
          <Button size="sm" variant="ghost" onClick={load}>
            <RotateCw size={14} /> Refresh
          </Button>
        }
      />
      <div className="h-80 overflow-y-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={20} />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-slate-600">No console output yet. Start the server to see logs.</p>
        ) : (
          logs.map((l) => (
            <div key={l.id} className={levelColor(l.level)}>
              <span className="text-slate-600">[{new Date(l.created_at).toLocaleTimeString()}] </span>
              {l.line}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-800 p-3">
        <Input
          name="cmd"
          placeholder={canSend ? 'Type a command... (e.g. /say hello)' : 'Start the server to send commands'}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          disabled={!canSend}
          className="font-mono"
        />
        <Button onClick={onSend} disabled={!canSend || sending || !cmd.trim()}>
          <Send size={14} />
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Plugins ---------------- */
function PluginsTab({ serverId }: { serverId: string }) {
  const [installed, setInstalled] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await fetchPlugins(serverId);
    setInstalled(p);
    setLoading(false);
  }, [serverId]);

  useEffect(() => { void load(); }, [load]);

  const isInstalled = (name: string) => installed.some((p) => p.name.toLowerCase() === name.toLowerCase());

  const onInstall = async (name: string, version: string) => {
    setInstalling(name);
    try {
      await installPlugin(serverId, name, version);
      load();
    } finally {
      setInstalling(null);
    }
  };

  const onToggle = async (id: string, enabled: boolean) => {
    await togglePlugin(id, enabled);
    load();
  };

  const onRemove = async (id: string, name: string) => {
    await deletePlugin(id, serverId, name);
    load();
  };

  const catalog = PLUGIN_CATALOG.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Installed */}
      <Card>
        <CardHeader title="Installed Plugins" subtitle={`${installed.length} plugin${installed.length === 1 ? '' : 's'}`} />
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner size={20} />
          </div>
        ) : installed.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No plugins installed yet. Browse the catalog below.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {installed.map((p) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[p.name] || Icons.Package;
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                    <Package size={16} className="text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{p.name}</p>
                    <p className="text-xs text-slate-500">v{p.version} · installed {timeAgo(p.installed_at)}</p>
                  </div>
                  <button onClick={() => onToggle(p.id, !p.enabled)} className="text-slate-500 hover:text-slate-300">
                    {p.enabled ? <ToggleRight size={22} className="text-emerald-400" /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => onRemove(p.id, p.name)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Catalog */}
      <Card>
        <CardHeader title="Plugin Installer" subtitle="Browse and install popular plugins" />
        <div className="p-5">
          <Input
            name="pluginsearch"
            placeholder="Search plugins..."
            icon={<Search size={16} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.map((p) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[p.icon] || Icons.Package;
              const exists = isInstalled(p.name);
              return (
                <div key={p.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                        <Icon size={16} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">{p.name.trim()}</p>
                        <p className="text-xs text-slate-500">v{p.version} · {p.author}</p>
                      </div>
                    </div>
                    <Badge>{p.category}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-600">{p.downloads} downloads</span>
                    {exists ? (
                      <Badge bg="bg-emerald-500/10" text="text-emerald-400" dot="bg-emerald-400">Installed</Badge>
                    ) : (
                      <Button size="sm" onClick={() => onInstall(p.name.trim(), p.version)} disabled={installing === p.name.trim()}>
                        {installing === p.name.trim() ? <Spinner size={14} /> : <><Plus size={14} /> Install</>}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Properties ---------------- */
function PropertiesTab({ serverId }: { serverId: string }) {
  const [props, setProps] = useState<ServerProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const p = await fetchProperties(serverId);
    setProps(p);
    setLoading(false);
  }, [serverId]);

  useEffect(() => { void load(); }, [load]);

  const onChange = (id: string, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await Promise.all(Object.entries(edits).map(([id, value]) => updateProperty(id, value)));
      setEdits({});
      setSaved(true);
      load();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="server.properties"
        subtitle="Edit server configuration values"
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-400">Saved!</span>}
            <Button size="sm" onClick={onSave} disabled={saving || Object.keys(edits).length === 0}>
              {saving ? <Spinner size={14} /> : <><Save size={14} /> Save</>}
            </Button>
          </div>
        }
      />
      <div className="divide-y divide-slate-800">
        {props.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-3">
            <div className="w-48 shrink-0">
              <p className="font-mono text-xs text-slate-300">{p.key}</p>
              {!p.editable && <span className="text-xs text-slate-600">read-only</span>}
            </div>
            <input
              className={`flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                !p.editable ? 'opacity-50' : ''
              }`}
              value={edits[p.id] ?? p.value}
              onChange={(e) => onChange(p.id, e.target.value)}
              disabled={!p.editable}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Settings (rename + danger) ---------------- */
function SettingsTab({ server, isAdmin, onDelete }: { server: Server; isAdmin: boolean; onDelete: () => void }) {
  const [name, setName] = useState(server.name);
  const [motd, setMotd] = useState(server.motd);
  const [maxPlayers, setMaxPlayers] = useState(server.max_players);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateServer(server.id, { name: name.trim(), motd: motd.trim(), max_players: maxPlayers });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="General Settings" subtitle="Rename and configure your server" />
        <div className="space-y-4 p-5">
          <Input label="Server Name" name="rename" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="MOTD" name="motd" value={motd} onChange={(e) => setMotd(e.target.value)} />
          <Input label="Max Players" name="maxplayers" type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} />
          <div className="flex items-center gap-3">
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Spinner size={14} /> : <><Save size={14} /> Save Changes</>}
            </Button>
            {saved && <span className="text-sm text-emerald-400">Saved!</span>}
          </div>
        </div>
      </Card>

      {isAdmin && (
        <Card className="border-red-500/20">
          <CardHeader title="Danger Zone" subtitle="Irreversible actions" />
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-medium text-slate-200">Delete this server</p>
              <p className="text-xs text-slate-500">Removes the server and all associated data permanently.</p>
            </div>
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
