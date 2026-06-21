import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiMoreVertical,
  FiEdit2,
  FiCopy,
  FiRepeat,
  FiCalendar,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { BlockedPeriod } from '../types';

const REASONS = ['Private Event', 'Wedding', 'Cleaning', 'Maintenance', 'Staff Meeting'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Filter = 'today' | 'upcoming' | 'completed' | 'all';
type BlockStatus = 'active' | 'upcoming' | 'completed';

// Status colours mirror the reservation scheduler's language: active = orange,
// upcoming = blue, completed = gray.
const STATUS_STYLE: Record<BlockStatus, { label: string; pill: string; dot: string }> = {
  active: { label: 'Active', pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  upcoming: { label: 'Upcoming', pill: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  completed: { label: 'Completed', pill: 'bg-slate-200 text-slate-500', dot: 'bg-slate-400' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
function addDays(date: string, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function dateLabel(dStr: string) {
  return new Date(dStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
// The block's concrete start/end epoch-ms on a given calendar day (handles overnight).
function occurrenceMs(b: BlockedPeriod, dateStr: string) {
  const start = new Date(`${dateStr}T${b.startTime}`).getTime();
  let end = new Date(`${dateStr}T${b.endTime}`).getTime();
  if (end <= start) end += 24 * 3600 * 1000;
  return { start, end };
}
// Does this block occur on the given day? (SINGLE on date, or RECURRING by weekday/monthday.)
function occursOn(b: BlockedPeriod, dStr: string) {
  if (b.type === 'SINGLE') return b.date === dStr;
  const r = b.recurrenceRule;
  if (!r) return false;
  const d = new Date(dStr);
  if (r.freq === 'WEEKLY') return r.byWeekday === undefined || r.byWeekday === d.getDay();
  if (r.freq === 'MONTHLY') return r.byMonthDay === undefined || r.byMonthDay === d.getDate();
  return false;
}
function statusFor(start: number, end: number, now: number): BlockStatus {
  if (now >= end) return 'completed';
  if (now >= start) return 'active';
  return 'upcoming';
}
function describeRecurrence(b: BlockedPeriod) {
  const r = b.recurrenceRule;
  if (!r) return 'Recurring';
  if (r.freq === 'WEEKLY' && r.byWeekday !== undefined) return `Every ${WEEKDAYS[r.byWeekday]}`;
  if (r.freq === 'MONTHLY' && r.byMonthDay !== undefined) return `Monthly · day ${r.byMonthDay}`;
  return r.freq === 'WEEKLY' ? 'Weekly' : 'Monthly';
}

export default function BlockedPeriodsPage() {
  const { restaurant } = useAuth();
  const [blocks, setBlocks] = useState<BlockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('today');
  const [date, setDate] = useState(todayStr());
  // form modal: null = closed, 'new' = create, object = edit
  const [editing, setEditing] = useState<BlockedPeriod | 'new' | null>(null);
  // Context menu anchored to the clicked ⋮ button (fixed-positioned so it
  // escapes the table card's overflow-hidden clipping).
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const now = Date.now();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBlocks(await api.listBlocked());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const tableName = useCallback(
    (id: string) => {
      const t = restaurant?.tables.find((x) => x.id === id);
      return t ? `Table ${t.number}` : '—';
    },
    [restaurant],
  );
  const zoneName = useCallback(
    (id: string | null) => restaurant?.zones.find((z) => z.id === id)?.name ?? '',
    [restaurant],
  );
  const affected = useCallback(
    (b: BlockedPeriod) =>
      b.scope === 'ZONE'
        ? `Zone: ${zoneName(b.zoneId)}`
        : b.tableIds.map(tableName).join(', ') || '—',
    [zoneName, tableName],
  );

  // Rows for the current filter, each carrying a computed status + a date label.
  const rows = useMemo(() => {
    type Row = { b: BlockedPeriod; status: BlockStatus; dateText: string; sort: number };
    const mk = (b: BlockedPeriod, dStr: string): Row => {
      const { start, end } = occurrenceMs(b, dStr);
      return {
        b,
        status: statusFor(start, end, now),
        dateText: b.type === 'RECURRING' ? describeRecurrence(b) : dStr,
        sort: start,
      };
    };

    if (filter === 'today') {
      return blocks
        .filter((b) => occursOn(b, date))
        .map((b) => mk(b, date))
        .sort((a, b) => toMin(a.b.startTime) - toMin(b.b.startTime));
    }

    const enriched: Row[] = blocks.map((b) => {
      if (b.type === 'RECURRING') {
        // Recurring blocks recur forever — never "completed". Active only while
        // today's occurrence is happening right now, otherwise upcoming.
        const t = todayStr();
        let status: BlockStatus = 'upcoming';
        if (occursOn(b, t)) {
          const { start, end } = occurrenceMs(b, t);
          status = statusFor(start, end, now);
          if (status === 'completed') status = 'upcoming';
        }
        return { b, status, dateText: describeRecurrence(b), sort: Number.MAX_SAFE_INTEGER };
      }
      return mk(b, b.date || todayStr());
    });

    let list = enriched;
    if (filter === 'upcoming') list = enriched.filter((r) => r.status !== 'completed');
    else if (filter === 'completed') list = enriched.filter((r) => r.status === 'completed');
    return list.sort((a, b) => a.sort - b.sort);
  }, [blocks, filter, date, now]);

  const duplicate = async (b: BlockedPeriod) => {
    setMenu(null);
    await api.createBlocked({
      scope: b.scope,
      tableIds: b.tableIds,
      zoneId: b.zoneId,
      type: b.type,
      date: b.date,
      recurrenceRule: b.recurrenceRule,
      startTime: b.startTime,
      endTime: b.endTime,
      reason: b.reason,
    });
    await load();
  };
  const remove = async (b: BlockedPeriod) => {
    setMenu(null);
    if (!confirm('Delete this blocked period?')) return;
    await api.deleteBlocked(b.id);
    await load();
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Blocked Periods</h2>
          <p className="text-slate-500 text-sm">
            Block resources for events, cleaning, or maintenance — customers can't book them.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <FiPlus /> Block Period
        </button>
      </div>

      {/* Controls: filter tabs + (day-view) date navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 font-medium ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filter === 'today' && (
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setDate(addDays(date, -1))} className="px-2 py-2 hover:bg-slate-50" title="Previous day">
              <FiChevronLeft />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-2 text-sm focus:outline-none"
            />
            <button onClick={() => setDate(addDays(date, 1))} className="px-2 py-2 hover:bg-slate-50" title="Next day">
              <FiChevronRight />
            </button>
            <button
              onClick={() => setDate(todayStr())}
              disabled={date === todayStr()}
              className="px-3 py-2 text-sm font-medium border-l border-slate-200 text-indigo-600 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
              title="Jump to today"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {filter === 'today' && (
        <p className="text-xs text-slate-400 -mt-1">
          Showing blocks for <span className="font-medium text-slate-600">{dateLabel(date)}</span>
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {filter === 'today'
              ? `No blocked periods for ${dateLabel(date)}.`
              : 'No blocked periods.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Reason</th>
                <th className="text-left px-3 py-3 font-semibold">Date</th>
                <th className="text-left px-3 py-3 font-semibold">Start</th>
                <th className="text-left px-3 py-3 font-semibold">End</th>
                <th className="text-left px-3 py-3 font-semibold">Affected resource</th>
                <th className="text-left px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ b, status, dateText }) => {
                const st = STATUS_STYLE[status];
                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50 ${status === 'completed' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                        <span className="text-slate-400">
                          {b.type === 'RECURRING' ? <FiRepeat size={14} /> : <FiCalendar size={14} />}
                        </span>
                        {b.reason}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{dateText}</td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">{b.startTime}</td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">{b.endTime}</td>
                    <td className="px-3 py-3 text-slate-600">{affected(b)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${st.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => {
                          if (menu?.id === b.id) { setMenu(null); return; }
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu({ id: b.id, x: r.right, y: r.bottom + 4 });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Actions"
                      >
                        <FiMoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Row actions menu — fixed so it's never clipped by the table card. */}
      {menu && (() => {
        const b = blocks.find((x) => x.id === menu.id);
        if (!b) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
            <div
              className="fixed z-50 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-sm"
              style={{ left: Math.max(8, menu.x - 160), top: Math.min(menu.y, window.innerHeight - 132) }}
            >
              <button
                onClick={() => { setMenu(null); setEditing(b); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <FiEdit2 size={14} /> Edit
              </button>
              <button
                onClick={() => duplicate(b)}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <FiCopy size={14} /> Duplicate
              </button>
              <button
                onClick={() => remove(b)}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-red-600"
              >
                <FiTrash2 size={14} /> Delete
              </button>
            </div>
          </>
        );
      })()}

      {editing && (
        <BlockForm
          initial={editing === 'new' ? null : editing}
          defaultDate={date}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function BlockForm({
  initial,
  defaultDate,
  onClose,
  onSaved,
}: {
  initial: BlockedPeriod | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { restaurant } = useAuth();
  const isEdit = !!initial;
  const tables = useMemo(
    () => [...(restaurant?.tables || [])].sort((a, b) => a.number - b.number),
    [restaurant],
  );
  const zones = restaurant?.zones || [];

  const [reason, setReason] = useState(initial?.reason || REASONS[0]);
  const [scope, setScope] = useState<'TABLES' | 'ZONE'>(initial?.scope || 'TABLES');
  const [zoneId, setZoneId] = useState(initial?.zoneId || zones[0]?.id || '');
  const [tableIds, setTableIds] = useState<string[]>(initial?.tableIds || []);
  const [type, setType] = useState<'SINGLE' | 'RECURRING'>(initial?.type || 'SINGLE');
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [freq, setFreq] = useState<'WEEKLY' | 'MONTHLY'>(initial?.recurrenceRule?.freq || 'WEEKLY');
  const [byWeekday, setByWeekday] = useState(initial?.recurrenceRule?.byWeekday ?? 1);
  const [byMonthDay, setByMonthDay] = useState(initial?.recurrenceRule?.byMonthDay ?? 1);
  const [startTime, setStartTime] = useState(initial?.startTime || '18:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '22:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTable = (id: string) =>
    setTableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setError('');
    if (scope === 'TABLES' && tableIds.length === 0) {
      setError('Select at least one resource, or block a whole zone.');
      return;
    }
    setSaving(true);
    const payload = {
      scope,
      tableIds: scope === 'TABLES' ? tableIds : [],
      zoneId: scope === 'ZONE' ? zoneId : null,
      type,
      date: type === 'SINGLE' ? date : null,
      recurrenceRule:
        type === 'RECURRING'
          ? freq === 'WEEKLY'
            ? { freq, byWeekday }
            : { freq, byMonthDay }
          : null,
      startTime,
      endTime,
      reason,
    };
    try {
      if (isEdit) await api.updateBlocked(initial!.id, payload);
      else await api.createBlocked(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{isEdit ? 'Edit Blocked Period' : 'New Blocked Period'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Reason</span>
            <select className="tb-input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>

          {/* Scope */}
          <div>
            <span className="text-xs font-medium text-slate-600 mb-1 block">Applies to</span>
            <div className="flex gap-2 mb-2">
              {(['TABLES', 'ZONE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    scope === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s === 'TABLES' ? 'Specific resources' : 'Entire zone'}
                </button>
              ))}
            </div>
            {scope === 'ZONE' ? (
              <select className="tb-input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTable(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      tableIds.includes(t.id)
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    T{t.number}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schedule type */}
          <div>
            <span className="text-xs font-medium text-slate-600 mb-1 block">Schedule</span>
            <div className="flex gap-2 mb-2">
              {(['SINGLE', 'RECURRING'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setType(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    type === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s === 'SINGLE' ? 'One-off' : 'Recurring'}
                </button>
              ))}
            </div>
            {type === 'SINGLE' ? (
              <input type="date" className="tb-input" value={date} onChange={(e) => setDate(e.target.value)} />
            ) : (
              <div className="flex gap-2">
                <select className="tb-input" value={freq} onChange={(e) => setFreq(e.target.value as 'WEEKLY' | 'MONTHLY')}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
                {freq === 'WEEKLY' ? (
                  <select className="tb-input" value={byWeekday} onChange={(e) => setByWeekday(Number(e.target.value))}>
                    {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className="tb-input"
                    value={byMonthDay}
                    onChange={(e) => setByMonthDay(Number(e.target.value))}
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Start</span>
              <input type="time" className="tb-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">End</span>
              <input type="time" className="tb-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create block'}
          </button>
        </div>
      </div>
    </div>
  );
}
