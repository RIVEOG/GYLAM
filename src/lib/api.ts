const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken(): string | null {
  return localStorage.getItem('gylam_token');
}

async function request<T>(p: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${p}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export interface SafeUser { id: string; username: string; email: string; is_admin: boolean; created_at: string; }
export interface AuthResponse { user: SafeUser; token: string; }

export const api = {
  register: (username: string, email: string, password: string) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: SafeUser }>('/auth/me'),
  createAdmin: (username: string, email: string, password: string, secret: string) => request<{ user: SafeUser; message: string }>('/admin/create', { method: 'POST', body: JSON.stringify({ username, email, password, secret }) }),
  listUsers: () => request<{ users: SafeUser[] }>('/admin/users'),
  deleteUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  updateUser: (id: string, body: { is_admin?: boolean; username?: string }) => request<{ user: SafeUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
