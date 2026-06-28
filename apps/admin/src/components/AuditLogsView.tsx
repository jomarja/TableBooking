import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiUser, FiArrowRight } from 'react-icons/fi';
import { api, type AdminRestaurant, type AuditEntry } from '../api/client';
import { Select } from './Select';

const ACTIONS = [
  'Impersonation Started',
  'Impersonation Ended',
  'Reservation Created',
  'Reservation Edited',
  'Reservation Cancelled',
  'Reservation Deleted',
  'Table Capacity Changed',
  'Resource Created',
  'Resource Deleted',
  'Opening Hours Changed',
  'Restaurant Settings Changed',
  'Floor Plan Changed',
  'Zones Changed',
  'Blocked Period Created',
  'Blocked Period Changed',
  'Blocked Period Deleted',
  'Password Reset',
  'Restaurant Created',
  'Restaurant Suspended',
  'Restaurant Approved',
  'Restaurant Archived',
  'Changed Rating',
];

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AuditLogsView({ restaurants }: { restaurants: AdminRestaurant[] }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [action, setAction] = useState('');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.auditLogs({ from, to, restaurantId, action, role });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [from, to, restaurantId, action, role]);

  useEffect(() => {
    void load();
  }, [load]);

  // Free-text search is applied client-side for instant feedback.
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) =>
      [e.userName, e.restaurantName, e.action, e.target, e.oldValue, e.newValue]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s),
    );
  }, [entries, search]);

  const reset = () => {
    setFrom('');
    setTo('');
    setRestaurantId('');
    setAction('');
    setRole('');
    setSearch('');
  };

  const hasFilters = from || to || restaurantId || action || role || search;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs font-medium text-slate-500">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700" />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-500">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700" />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-500">
            Restaurant
            <Select
              value={restaurantId}
              onChange={(v) => setRestaurantId(v)}
              options={[{ value: '', label: 'All' }, ...restaurants.map((r) => ({ value: r.id, label: r.name }))]}
              ariaLabel="Restaurant"
              className="mt-1 max-w-[180px]"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-500">
            Action
            <Select
              value={action}
              onChange={(v) => setAction(v)}
              options={[{ value: '', label: 'All' }, ...ACTIONS.map((a) => ({ value: a, label: a }))]}
              ariaLabel="Action"
              className="mt-1 max-w-[180px]"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-500">
            Role
            <Select
              value={role}
              onChange={(v) => setRole(v)}
              options={[
                { value: '', label: 'All' },
                { value: 'admin', label: 'Admin' },
                { value: 'staff', label: 'Restaurant Owner' },
              ]}
              ariaLabel="Role"
              className="mt-1 w-40"
            />
          </label>
          <button onClick={load} disabled={loading} className="ml-auto p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50" title="Reload">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, reservation #, restaurant, or action…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {hasFilters && (
            <button onClick={reset} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Clear</button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No matching activity.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((e) => (
              <li key={e.id} className="flex gap-4 px-5 py-3 hover:bg-slate-50">
                <div className="w-32 shrink-0 text-xs text-slate-400 tabular-nums pt-0.5">{formatTime(e.timestamp)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                      <FiUser size={12} className="text-slate-400" />
                      {e.userName}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${e.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {e.role === 'admin' ? 'Admin' : 'Restaurant Owner'}
                    </span>
                    {e.impersonating && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        impersonating
                      </span>
                    )}
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{e.restaurantName}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-700">{e.action}</span>
                    {e.target && <span className="text-slate-500">· {e.target}</span>}
                    {(e.oldValue || e.newValue) && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                        {e.oldValue && <span className="line-through text-slate-400">{e.oldValue}</span>}
                        {e.oldValue && e.newValue && <FiArrowRight size={11} />}
                        {e.newValue && <span className="text-slate-700 font-medium">{e.newValue}</span>}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-400 text-center">
        Showing {visible.length} {visible.length === 1 ? 'entry' : 'entries'} · newest first. Audit history is retained indefinitely.
      </p>
    </div>
  );
}
