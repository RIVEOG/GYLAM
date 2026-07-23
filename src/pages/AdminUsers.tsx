import { useEffect, useState } from 'react';
import { api, type SafeUser } from '@/lib/api';
import { Users as UsersIcon, Trash2, Shield, ShieldOff, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<SafeUser | null>(null);

  const load = () => {
    api.listUsers()
      .then(({ users }) => setUsers(users))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (u: SafeUser) => {
    try {
      await api.updateUser(u.id, { is_admin: !u.is_admin });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteUser(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = users.filter(
    (u) => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Users</h1>
        <p className="text-sm text-slate-500">Manage panel users and admin privileges.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input className="input pl-9" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-slate-500">{users.length} total</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {u.username[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-200">{u.username}</span>
                    {u.id === currentUser?.id && <span className="text-xs text-slate-600">(you)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                      <Shield size={12} /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/30 px-2 py-0.5 text-xs font-medium text-slate-400">
                      User
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={u.id === currentUser?.id}
                      title={u.is_admin ? 'Demote to user' : 'Promote to admin'}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                    >
                      {u.is_admin ? <ShieldOff size={14} /> : <Shield size={14} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(u)}
                      disabled={u.id === currentUser?.id}
                      title="Delete user"
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-600">
                  <UsersIcon size={24} className="mx-auto mb-2 opacity-50" />
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Delete user?</h3>
            <p className="mt-2 text-sm text-slate-400">Are you sure you want to delete <span className="font-semibold text-slate-200">{confirmDelete.username}</span>?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={doDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
