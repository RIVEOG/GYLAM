export interface SafeUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

interface AuthResponse {
  user: SafeUser;
  token: string;
}

export interface PanelNode {
  id: string;
  name: string;
  ip_assigned: string;
  status: 'online' | 'offline';
  location?: string;
  ram_total_mb: number;
  disk_total_mb: number;
  cpu_total_percent: number;
}

function getToken(): string | null {
  return localStorage.getItem('gylam_token');
}

async function request<T>(p: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${p}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: SafeUser }>('/auth/me'),
  createAdmin: (username: string, email: string, password: string, secret: string) =>
    request<{ user: SafeUser; message: string }>('/admin/create', { method: 'POST', body: JSON.stringify({ username, email, password, secret }) }),
  listUsers: () => request<{ users: SafeUser[] }>('/admin/users'),
  deleteUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  updateUser: (id: string, body: { is_admin?: boolean; username?: string }) =>
    request<{ user: SafeUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listNodes: () => request<{ nodes: PanelNode[] }>('/nodes'),
  createNode: (body: { name: string; ip_assigned: string; location?: string; ram_total_mb?: number; disk_total_mb?: number; cpu_total_percent?: number }) =>
    request<{ node: PanelNode }>('/nodes', { method: 'POST', body: JSON.stringify(body) }),
  deleteNode: (id: string) => request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' }),
};
