export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  ip_assigned: string;
  status: 'online' | 'offline';
  location?: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
  created_at: string;
}

export interface GameServer {
  id: string;
  name: string;
  type: string;
  node_id: string;
  owner_id: string;
  owner_name: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping';
  port: number;
  ram_mb: number;
  disk_mb: number;
  cpu_percent: number;
  players: number;
  max_players: number;
  created_at: string;
}
