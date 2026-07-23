export type ServerStatus = 'offline' | 'starting' | 'running' | 'stopping' | 'crashed';
export type NodeStatus = 'offline' | 'online';

export interface Profile {
  id: string;
  username: string;
  email?: string;
  is_admin: boolean;
  avatar_color: string;
  created_at: string;
}

export interface Settings {
  free_servers_enabled: boolean;
  free_ram_mb: number;
  free_disk_mb: number;
  free_cpu_percent: number;
  panel_name: string;
  panel_url: string;
}

export interface Node {
  id: string;
  name: string;
  status: NodeStatus;
  ip_assigned: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
  location: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  category: string;
  default_ram_mb: number;
  default_disk_mb: number;
  default_cpu_percent: number;
  default_port: number;
  sort_order: number;
}

export interface Server {
  id: string;
  name: string;
  user_id: string;
  node_id: string | null;
  template_id: string | null;
  template_name: string;
  status: ServerStatus;
  is_free: boolean;
  ram_mb: number;
  disk_mb: number;
  cpu_percent: number;
  port: number;
  motd: string;
  max_players: number;
  version: string;
  sftp_user: string | null;
  sftp_pass: string | null;
  created_at: string;
  node?: Node | null;
  template?: Template | null;
}

export interface Plugin {
  id: string;
  server_id: string;
  name: string;
  version: string;
  source: string;
  status: string;
  enabled: boolean;
  installed_at: string;
}

export interface ServerProperty {
  id: string;
  server_id: string;
  key: string;
  value: string;
  editable: boolean;
  sort_order: number;
}

export interface LogLine {
  id: string;
  server_id: string;
  line: string;
  level: string;
  created_at: string;
}

export interface PluginCatalogItem {
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  downloads: string;
  icon: string;
}

export interface DefaultProperty {
  key: string;
  value: string;
  editable: boolean;
}
