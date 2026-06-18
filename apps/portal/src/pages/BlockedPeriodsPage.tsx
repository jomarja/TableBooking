import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiX, FiRepeat, FiCalendar } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { BlockedPeriod } from '../types';

const REASONS = ['Private Event', 'Wedding', 'Cleaning', 'Maintenance', 'Staff Meeting'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BlockedPeriodsPage() {
  const { restaurant } = useAuth();
  const [blocks, setBlocks] = useState<BlockedPeriod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const tableNum = (id: string) =>
    restaurant?.tables.find((t) => t.id === id)?.number ?? '?';
  const zoneName = (id: string | null) =>
    restaurant?.zones.find((z) => z.id === id)?.name ?? '';

  const describe = (b: BlockedPeriod) => {
    if (b.type === 'RECURRING' && b.recurrenceRule) {
      const r = b.recurrenceRule;
      if (r.freq === 'WEEKLY' && r.byWeekday !== undefined) return `Every ${WEEKDAYS[r.byWeekday]}`;
      if (r.freq === 'MONTHLY' && r.byMonthDay !== undefined) return `Monthly on day ${r.byMonthDay}`;
      return r.freq === 'WEEKLY' ? 'Weekly' : 'Monthly';
    }
    return b.date || '';
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this blocked period?')) return;
    await api.deleteBlocked(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Blocked Periods</h2>
          <p className="text-slate-500 text-sm">
            Block tables or whole zones for events, cleaning, or maintenance — customers can't book them.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <FiPlus /> New block
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No blocked periods yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  {b.type === 'RECURRING' ? <FiRepeat /> : <FiCalendar />}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{b.reason}</p>
                  <p className="text-xs text-slate-500">
                    {describe(b)} · {b.startTime}–{b.endTime} ·{' '}
                    {b.scope === 'ZONE'
                      ? `Zone: ${zoneName(b.zoneId)}`
                      : `Tables: ${b.tableIds.map(tableNum).join(', ') || '—'}`}
                  </p>
                </div>
              </div>
              <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-red-500 p-2">
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BlockForm
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function BlockForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { restaurant } = useAuth();
  const tables = useMemo(
    () => [...(restaurant?.tables || [])].sort((a, b) => a.number - b.number),
    [restaurant],
  );
  const zones = restaurant?.zones || [];

  const [reason, setReason] = useState(REASONS[0]);
  const [scope, setScope] = useState<'TABLES' | 'ZONE'>('TABLES');
  const [zoneId, setZoneId] = useState(zones[0]?.id || '');
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [type, setType] = useState<'SINGLE' | 'RECURRING'>('SINGLE');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [freq, setFreq] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [byWeekday, setByWeekday] = useState(1);
  const [byMonthDay, setByMonthDay] = useState(1);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTable = (id: string) =>
    setTableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setError('');
    if (scope === 'TABLES' && tableIds.length === 0) {
      setError('Select at least one table, or block a whole zone.');
      return;
    }
    setSaving(true);
    try {
      await api.createBlocked({
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
      });
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
          <h3 className="text-lg font-bold text-slate-800">New Blocked Period</h3>
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
                  {s === 'TABLES' ? 'Specific tables' : 'Entire zone'}
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
            {saving ? 'Saving…' : 'Create block'}
          </button>
        </div>
      </div>
    </div>
  );
}
