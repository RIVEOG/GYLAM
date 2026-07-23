export function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(iso);
}

export function statusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'running':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' };
    case 'starting':
      return { bg: 'bg-sky-500/10', text: 'text-sky-400', dot: 'bg-sky-400' };
    case 'stopping':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' };
    case 'crashed':
      return { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' };
  }
}

export function nodeStatusColor(status: string) {
  return status === 'online'
    ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' }
    : { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function randomColor(): string {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function genPassword(len = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function genUsername(prefix = 'sftp'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pct(used: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round((used / total) * 100), 0, 100);
}
