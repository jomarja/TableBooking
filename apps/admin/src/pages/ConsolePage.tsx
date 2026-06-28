import { useCallback, useEffect, useState } from 'react';
import {
  FiLogOut,
  FiPlus,
  FiCheck,
  FiSlash,
  FiKey,
  FiRefreshCw,
  FiSearch,
  FiEdit2,
  FiStar,
  FiLogIn,
  FiGrid,
  FiActivity,
} from 'react-icons/fi';
import { api, PORTAL_URL, type AdminRestaurant, type AdminStats } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CreateRestaurantModal } from '../components/CreateRestaurantModal';
import { EditRestaurantModal } from '../components/EditRestaurantModal';
import { AuditLogsView } from '../components/AuditLogsView';
import ConfirmDialog from '../components/ConfirmDialog';

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DISABLED: 'bg-slate-200 text-slate-500',
};

export default function ConsolePage() {
  const { logout } = useAuth();
  const [view, setView] = useState<'restaurants' | 'audit'>('restaurants');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([api.stats(), api.listRestaurants()]);
      setStats(s);
      setRestaurants(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } finally {
      setBusy(null);
    }
  };

  const resetPw = async (r: AdminRestaurant) => {
    const pw = prompt(`New password for ${r.name} (owner: ${r.staff[0]?.email})`, 'password');
    if (!pw) return;
    await act(() => api.resetPassword(r.id, pw), r.id);
    alert('Password reset. The owner will be prompted to complete setup on next login.');
  };

  // "Login as Restaurant" — mint an impersonation token and hand off to the
  // portal (separate origin) via a one-time URL param. The admin session on
  // this origin is left untouched, so exiting impersonation returns here.
  const loginAs = async (r: AdminRestaurant) => {
    setBusy(r.id);
    try {
      const res = await api.impersonate(r.id);
      window.location.href = `${PORTAL_URL}/?impersonate=${encodeURIComponent(res.token)}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start impersonation');
      setBusy(null);
    }
  };

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.address.toLowerCase().includes(query.toLowerCase()),
  );

  const statCards = stats
    ? [
        { label: 'Restaurants', value: stats.restaurants },
        { label: 'Approved', value: stats.approved },
        { label: 'Pending', value: stats.pending },
        { label: 'Disabled', value: stats.disabled },
        { label: 'Reservations', value: stats.reservations },
        { label: 'Today', value: stats.todayReservations },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">TableBooker</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">Admin</span>
          </div>
          <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <FiLogOut /> Log out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* View tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setView('restaurants')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'restaurants' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FiGrid /> Restaurants
          </button>
          <button
            onClick={() => setView('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FiActivity /> Audit Logs
          </button>
        </div>

        {view === 'audit' && <AuditLogsView restaurants={restaurants} />}

        {view === 'restaurants' && (
        <>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {statCards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">Restaurant Management</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50" title="Reload">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <FiPlus /> Create restaurant
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <p className="p-8 text-center text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-slate-400">No restaurants.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Restaurant</th>
                  <th className="text-left px-3 py-3 font-semibold">Owner</th>
                  <th className="text-left px-3 py-3 font-semibold">Status</th>
                  <th className="text-left px-3 py-3 font-semibold">Tables</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{r.name}</p>
                        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600" title={`${r.reviewCount} reviews`}>
                          <FiStar className="fill-amber-400 text-amber-400" size={12} /> {r.rating}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{r.address || 'No address'}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {r.staff[0]?.email || '—'}
                      {r.staff[0]?.firstLogin && (
                        <span className="ml-1 text-[10px] text-amber-600">(setup pending)</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{r.tableCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          disabled={busy === r.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-100"
                          title="Edit restaurant"
                        >
                          <FiEdit2 /> Edit
                        </button>
                        {r.status !== 'APPROVED' && (
                          <button
                            onClick={() => act(() => api.setStatus(r.id, 'APPROVED'), r.id)}
                            disabled={busy === r.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-700 hover:bg-emerald-50"
                            title="Approve"
                          >
                            <FiCheck /> Approve
                          </button>
                        )}
                        {r.status !== 'DISABLED' && (
                          <button
                            onClick={() => act(() => api.setStatus(r.id, 'DISABLED'), r.id)}
                            disabled={busy === r.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-100"
                            title="Suspend restaurant"
                          >
                            <FiSlash /> Suspend
                          </button>
                        )}
                        <button
                          onClick={() => loginAs(r)}
                          disabled={busy === r.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                          title="Open the portal as this restaurant"
                        >
                          <FiLogIn /> Login as Restaurant
                        </button>
                        <button
                          onClick={() => resetPw(r)}
                          disabled={busy === r.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-indigo-600 hover:bg-indigo-50"
                          title="Reset password"
                        >
                          <FiKey /> Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>
        )}
      </main>

      {creating && (
        <CreateRestaurantModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}

      {editing && (
        <EditRestaurantModal
          restaurant={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        tone="danger"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
