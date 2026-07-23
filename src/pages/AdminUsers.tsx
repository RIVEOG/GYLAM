import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, Search, Users as UsersIcon } from 'lucide-react';
import { fetchAllProfiles, setAdminFlag } from '@/lib/db';
import type { Profile } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { initials, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

export function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = () => {
    fetchAllProfiles()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleAdmin = async (u: Profile) => {
    if (u.id === profile?.id) return;
    await setAdminFlag(u.id, !u.is_admin);
    load();
  };

  const filtered = users.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        name="usersearch"
        placeholder="Search users..."
        icon={<Search size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="sm:w-72"
      />

      <Card>
        <CardHeader title="Users" subtitle={`${users.length} registered`} />
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <UsersIcon size={28} className="text-slate-600" />
            <p className="text-sm text-slate-400">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-5 py-3 text-left font-medium">User</th>
                  <th className="px-5 py-3 text-left font-medium">Role</th>
                  <th className="px-5 py-3 text-left font-medium">Joined</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: u.avatar_color }}>
                          {initials(u.username)}
                        </div>
                        <span className="font-medium text-slate-200">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {u.is_admin ? (
                        <Badge bg="bg-blue-500/10" text="text-blue-400" dot="bg-blue-400">Admin</Badge>
                      ) : (
                        <Badge>User</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant={u.is_admin ? 'secondary' : 'primary'}
                        onClick={() => toggleAdmin(u)}
                        disabled={u.id === profile?.id}
                      >
                        {u.is_admin ? <><Shield size={12} /> Remove Admin</> : <><ShieldCheck size={12} /> Make Admin</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
