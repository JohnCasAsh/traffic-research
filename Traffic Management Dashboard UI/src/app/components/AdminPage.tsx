import { useEffect, useState } from 'react';
import { Shield, Users, LogIn, RefreshCw, Clock, Wifi, Ban, Trash2, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  banned: boolean;
  created_at: string | null;
  auth_providers: string[];
};

type LoginRow = {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  created_at: string | null;
  user: { firstName: string; lastName: string; role: string } | null;
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminPage() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'logins'>('logins');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: buildAuthHeaders(token) }),
        fetch(`${API_URL}/api/admin/logins`, { headers: buildAuthHeaders(token) }),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users);
      if (lRes.ok) setLogins((await lRes.json()).logins);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleBan = async (u: UserRow) => {
    if (!token) return;
    const action = u.banned ? 'unban' : 'ban';
    setActionLoading(`${action}-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}/${action}`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, banned: !u.banned } : x));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakeAdmin = async (u: UserRow) => {
    if (!token) return;
    setActionLoading(`make-admin-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}/make-admin`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: 'admin' } : x));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!token) return;
    setActionLoading(`delete-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.filter(x => x.id !== u.id));
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-sm text-slate-500">System access — restricted view</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{users.length}</p>
                <p className="text-xs text-slate-500">Registered Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <LogIn className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{logins.length}</p>
                <p className="text-xs text-slate-500">Recent Logins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['logins', 'users'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'logins' ? 'Login Activity' : 'All Users'}
            </button>
          ))}
        </div>

        {/* Login Activity Table */}
        {tab === 'logins' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Login Activity
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : logins.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No login records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">User</th>
                      <th className="text-left px-6 py-3 font-medium">Role</th>
                      <th className="text-left px-6 py-3 font-medium">Method</th>
                      <th className="text-left px-6 py-3 font-medium">IP Address</th>
                      <th className="text-left px-6 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logins.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 font-medium text-slate-800">
                          {log.user
                            ? `${log.user.firstName} ${log.user.lastName}`.trim() || 'Unknown'
                            : <span className="text-slate-400 text-xs">Deleted user</span>}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.user?.role === 'admin'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {log.user?.role || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'OAUTH_LOGIN_SUCCESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-teal-100 text-teal-700'
                          }`}>
                            <Wifi className="w-3 h-3" />
                            {log.action === 'OAUTH_LOGIN_SUCCESS' ? 'OAuth' : 'Email'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">
                          {log.ip_address || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          <span title={formatDate(log.created_at)}>
                            {timeAgo(log.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Table */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                All Registered Users
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">Name</th>
                      <th className="text-left px-6 py-3 font-medium">Role</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-left px-6 py-3 font-medium">Auth</th>
                      <th className="text-left px-6 py-3 font-medium">Joined</th>
                      <th className="text-left px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isMe = u.id === me?.id;
                      const isAdmin = u.role === 'admin';
                      const banKey = `${u.banned ? 'unban' : 'ban'}-${u.id}`;
                      const deleteKey = `delete-${u.id}`;
                      const makeAdminKey = `make-admin-${u.id}`;
                      return (
                        <tr key={u.id} className={`hover:bg-slate-50 transition ${u.banned ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-3 font-medium text-slate-800">
                            {`${u.first_name} ${u.last_name}`.trim() || '—'}
                            {isMe && <span className="ml-2 text-xs text-teal-600">(you)</span>}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isAdmin ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {u.banned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <Ban className="w-3 h-3" /> Banned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                                <CheckCircle className="w-3 h-3" />
                                {u.email_verified ? 'Verified' : 'Pending'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-500 text-xs">
                            {u.auth_providers.length > 0 ? u.auth_providers.join(', ') : 'email'}
                          </td>
                          <td className="px-6 py-3 text-slate-500 text-xs">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            {isMe || isAdmin ? (
                              <span className="text-xs text-slate-300">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleBan(u)}
                                  disabled={actionLoading === banKey}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    u.banned
                                      ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  } disabled:opacity-50`}
                                >
                                  <Ban className="w-3 h-3" />
                                  {u.banned ? 'Unban' : 'Ban'}
                                </button>
                                {!u.banned && (
                                  <button
                                    onClick={() => handleMakeAdmin(u)}
                                    disabled={actionLoading === makeAdminKey}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition disabled:opacity-50"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    Make Admin
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDelete(u)}
                                  disabled={actionLoading === deleteKey}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete User</h3>
                <p className="text-xs text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-slate-900">
                {`${confirmDelete.first_name} ${confirmDelete.last_name}`.trim() || 'this user'}
              </span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading === `delete-${confirmDelete.id}`}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading === `delete-${confirmDelete.id}` ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
