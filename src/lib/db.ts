import { supabase } from './supabase';
import { DEFAULT_PROPERTIES } from './plugins';
import type {
  Profile,
  Node,
  Server,
  Template,
  Plugin,
  ServerProperty,
  LogLine,
  Settings,
} from './types';
import { genUsername, genPassword } from './utils';

/* ---------------- settings ---------------- */
export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return {
    free_servers_enabled: map.free_servers_enabled === 'true',
    free_ram_mb: Number(map.free_ram_mb ?? 2048),
    free_disk_mb: Number(map.free_disk_mb ?? 5120),
    free_cpu_percent: Number(map.free_cpu_percent ?? 100),
    panel_name: map.panel_name ?? 'Panel',
    panel_url: map.panel_url ?? '',
  };
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ---------------- profiles ---------------- */
export async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, avatar_color, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, email: user.email };
}

export async function updateProfileUsername(id: string, username: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ username }).eq('id', id);
  if (error) throw error;
}

export async function updateAvatarColor(id: string, color: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_color: color }).eq('id', id);
  if (error) throw error;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, avatar_color, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setAdminFlag(id: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', id);
  if (error) throw error;
}

/* ---------------- nodes ---------------- */
export async function fetchNodes(): Promise<Node[]> {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOnlineNodes(): Promise<Node[]> {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('status', 'online')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNode(input: {
  name: string;
  ip_assigned: string;
  status: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
  location: string;
}): Promise<Node> {
  const { data, error } = await supabase.from('nodes').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateNode(id: string, patch: Partial<Node>): Promise<void> {
  const { error } = await supabase.from('nodes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from('nodes').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- templates ---------------- */
export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(input: Omit<Template, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('templates').insert(input);
  if (error) throw error;
}

export async function updateTemplate(id: string, patch: Partial<Template>): Promise<void> {
  const { error } = await supabase.from('templates').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- servers ---------------- */
export async function fetchServers(): Promise<Server[]> {
  const { data, error } = await supabase
    .from('servers')
    .select('*, node:nodes(*), template:templates(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchServer(id: string): Promise<Server | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('*, node:nodes(*), template:templates(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createServer(input: {
  name: string;
  template_id: string;
  template_name: string;
  node_id: string | null;
  ram_mb: number;
  disk_mb: number;
  cpu_percent: number;
  port: number;
  motd: string;
  max_players: number;
  version: string;
  is_free: boolean;
}): Promise<Server> {
  const sftpUser = genUsername('srv');
  const sftpPass = genPassword(20);
  const payload = { ...input, sftp_user: sftpUser, sftp_pass: sftpPass };
  const { data, error } = await supabase.from('servers').insert(payload).select().single();
  if (error) throw error;

  // seed default server.properties
  const props = DEFAULT_PROPERTIES.map((p, i) => ({
    server_id: data.id,
    key: p.key,
    value: p.key === 'motd' ? input.motd : p.key === 'max-players' ? String(input.max_players) : p.key === 'server-port' ? String(input.port) : p.value,
    editable: p.editable,
    sort_order: i,
  }));
  await supabase.from('properties').insert(props);

  // seed a startup log
  await supabase.from('logs').insert({
    server_id: data.id,
    line: `Server "${input.name}" created (${input.template_name}). Status: offline.`,
    level: 'info',
  });

  return data;
}

export async function updateServerStatus(id: string, status: Server['status']): Promise<void> {
  const { error } = await supabase.from('servers').update({ status }).eq('id', id);
  if (error) throw error;

  const msgs: Record<string, string> = {
    starting: 'Starting server...',
    running: 'Server is now running.',
    stopping: 'Stopping server...',
    offline: 'Server stopped.',
    crashed: 'Server crashed unexpectedly.',
  };
  await supabase.from('logs').insert({
    server_id: id,
    line: msgs[status] ?? `Status changed to ${status}.`,
    level: status === 'crashed' ? 'error' : 'info',
  });
}

export async function updateServer(id: string, patch: Partial<Server>): Promise<void> {
  const { error } = await supabase.from('servers').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteServer(id: string): Promise<void> {
  const { error } = await supabase.from('servers').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- plugins ---------------- */
export async function fetchPlugins(serverId: string): Promise<Plugin[]> {
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .eq('server_id', serverId)
    .order('installed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function installPlugin(serverId: string, name: string, version: string): Promise<void> {
  const { error } = await supabase.from('plugins').insert({
    server_id: serverId,
    name: name.trim(),
    version,
    source: 'panel',
    status: 'installed',
    enabled: true,
  });
  if (error) throw error;
  await supabase.from('logs').insert({
    server_id: serverId,
    line: `Installed plugin ${name} v${version}.`,
    level: 'info',
  });
}

export async function togglePlugin(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('plugins').update({ enabled }).eq('id', id);
  if (error) throw error;
}

export async function deletePlugin(id: string, serverId: string, name: string): Promise<void> {
  const { error } = await supabase.from('plugins').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('logs').insert({
    server_id: serverId,
    line: `Removed plugin ${name}.`,
    level: 'warn',
  });
}

/* ---------------- properties ---------------- */
export async function fetchProperties(serverId: string): Promise<ServerProperty[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('server_id', serverId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateProperty(id: string, value: string): Promise<void> {
  const { error } = await supabase.from('properties').update({ value }).eq('id', id);
  if (error) throw error;
}

/* ---------------- logs ---------------- */
export async function fetchLogs(serverId: string, limit = 200): Promise<LogLine[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendCommand(serverId: string, command: string): Promise<void> {
  const clean = command.trim();
  if (!clean) return;
  await supabase.from('logs').insert({
    server_id: serverId,
    line: `[CONSOLE] ${clean}`,
    level: 'command',
  });
  // simulated server response
  const responses = [
    'Command executed.',
    'Done.',
    'Unknown command. Type "help" for help.',
    'Set the time to 1000.',
    'Teleported player to spawn.',
    'Game rule has been updated.',
  ];
  await supabase.from('logs').insert({
    server_id: serverId,
    line: `[SERVER] ${responses[Math.floor(Math.random() * responses.length)]}`,
    level: 'info',
  });
}
