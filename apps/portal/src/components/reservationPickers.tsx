import { useMemo, useState } from 'react';
import { FiX, FiUsers, FiClock, FiCheck } from 'react-icons/fi';
import type { Restaurant, TableModel } from '../types';
import { resourceLabel } from '../lib/resources';

// ── shared helpers ─────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const minToLabel = (m: number) => `${pad(Math.floor((((m % 1440) + 1440) % 1440) / 60))}:${pad((((m % 1440) + 1440) % 1440) % 60)}`;
const fmt12 = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  let h = Math.floor(mm / 60);
  const min = mm % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${pad(min)} ${ampm}`;
};
const daypartLabel = (m: number) => {
  const h = Math.floor((((m % 1440) + 1440) % 1440) / 60);
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Midday';
  if (h >= 17 && h < 22) return 'Evening';
  return 'Late night';
};

/** Shared dialog shell — sits above the reservation modal (z-[60]). */
function PickerShell({
  title,
  summary,
  onClose,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  onClose: () => void;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {summary && <div className="mt-0.5 text-sm text-slate-500">{summary}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <FiX size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Time picker (two-step: start → end) ────────────────────────
export function TimePickerDialog({
  startTime,
  endTime,
  openingTime,
  closingTime,
  defaultDuration,
  onConfirm,
  onClose,
}: {
  startTime: string;
  endTime: string;
  openingTime: string;
  closingTime: string;
  defaultDuration: number;
  onConfirm: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState<number | null>(startTime ? toMin(startTime) : null);
  const [end, setEnd] = useState<number | null>(endTime ? toMin(endTime) : null);
  const [step, setStep] = useState<'start' | 'end'>('start');
  const [fullDay, setFullDay] = useState(false);

  // Absolute-minute slots (handles overnight + optional full-day override).
  const slots = useMemo(() => {
    const open = fullDay ? 0 : toMin(openingTime);
    let close = fullDay ? 1440 - 15 : toMin(closingTime);
    if (!fullDay && close <= open) close += 1440;
    const out: number[] = [];
    for (let m = open; m <= close; m += 15) out.push(m);
    return out;
  }, [openingTime, closingTime, fullDay]);

  const sections = useMemo(() => {
    const out: { label: string; slots: number[] }[] = [];
    let cur: { label: string; slots: number[] } | null = null;
    for (const m of slots) {
      const dp = daypartLabel(m);
      if (!cur || cur.label !== dp) {
        cur = { label: dp, slots: [] };
        out.push(cur);
      }
      cur.slots.push(m);
    }
    return out;
  }, [slots]);

  const pickSlot = (m: number) => {
    const lastSlot = slots[slots.length - 1];
    if (step === 'start') {
      setStart(m);
      setEnd(Math.min(m + defaultDuration, lastSlot)); // keep end on a rendered slot
      setStep('end');
    } else {
      if (start != null && m <= start) {
        // Tapping at/before the start restarts the selection from there.
        setStart(m);
        setEnd(Math.min(m + defaultDuration, lastSlot));
        return;
      }
      setEnd(m);
    }
  };

  const reset = () => {
    setStart(null);
    setEnd(null);
    setStep('start');
  };

  const ready = start != null && end != null && end > start;

  return (
    <PickerShell
      title="Choose a time"
      summary={
        ready ? (
          <span className="font-medium text-indigo-600">
            {fmt12(start!)} – {fmt12(end!)}
          </span>
        ) : (
          'Pick a start, then an end time'
        )
      }
      onClose={onClose}
      confirmLabel="Choose time"
      confirmDisabled={!ready}
      onConfirm={() => ready && onConfirm(minToLabel(start!), minToLabel(end!))}
    >
      <div className="flex items-center gap-3 text-sm mb-3">
        <span className={step === 'start' ? 'font-semibold text-slate-800' : 'text-slate-400'}>1. Start time</span>
        <span className="text-slate-300">·</span>
        <span className={step === 'end' ? 'font-semibold text-slate-800' : 'text-slate-400'}>2. End time</span>
        {(start != null || end != null) && (
          <button onClick={reset} className="ml-auto text-indigo-600 hover:underline text-sm">
            reset
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={`${sec.label}-${sec.slots[0]}`}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{sec.label}</p>
            <div className="grid grid-cols-4 gap-2">
              {sec.slots.map((m) => {
                const isStart = m === start;
                const isEnd = m === end;
                const inRange = start != null && end != null && m > start && m < end;
                const disabled = step === 'end' && start != null && m <= start;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickSlot(m)}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                      isStart || isEnd
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : inRange
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : disabled
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {minToLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setFullDay((v) => !v)} className="mt-4 text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
        <FiClock size={13} /> {fullDay ? 'Only reservation hours' : 'Show all times (outside reservation hours)'}
      </button>
    </PickerShell>
  );
}

// ── Guest picker ───────────────────────────────────────────────
export function GuestPickerDialog({
  value,
  max,
  onConfirm,
  onClose,
}: {
  value: number;
  max?: number;
  onConfirm: (n: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(String(value || 2));
  const num = Math.max(1, parseInt(text, 10) || 0);
  const cap = max && max > 0 ? max : 12;
  const quick = Array.from({ length: Math.min(12, cap) }, (_, i) => i + 1);

  return (
    <PickerShell
      title="How many guests?"
      summary={<span className="inline-flex items-center gap-1.5"><FiUsers size={14} /> {num} {num === 1 ? 'person' : 'people'}</span>}
      onClose={onClose}
      confirmLabel="Select number"
      confirmDisabled={!text.trim()}
      onConfirm={() => onConfirm(num)}
    >
      <input
        type="number"
        min={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="tb-input mb-3 text-center text-lg font-semibold"
        autoFocus
      />
      <div className="grid grid-cols-4 gap-2">
        {quick.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setText(String(n))}
            className={`py-3 rounded-lg border text-sm font-medium transition-colors ${
              num === n
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            {n} {n === 1 ? 'person' : 'people'}
          </button>
        ))}
      </div>
      {max && max > 12 && (
        <p className="mt-3 text-xs text-slate-400">For more than 12, type the number above (max {max}).</p>
      )}
    </PickerShell>
  );
}

// ── Table picker ───────────────────────────────────────────────
export function TablePickerDialog({
  tables,
  restaurant,
  value,
  guests,
  onConfirm,
  onClose,
}: {
  tables: TableModel[];
  restaurant: Restaurant | null;
  value: string;
  guests: number;
  onConfirm: (tableId: string) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(value);
  const zones = restaurant?.zones || [];
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name || 'Unzoned';

  // Group tables by zone, sorted by table number within each.
  const groups = useMemo(() => {
    const map = new Map<string, TableModel[]>();
    for (const t of [...tables].sort((a, b) => a.number - b.number)) {
      const key = t.zoneId || '__none__';
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [tables]);

  const fits = (t: TableModel) => {
    const min = t.minCapacity || 1;
    return guests >= min && guests <= t.capacity;
  };

  return (
    <PickerShell
      title="Choose a table"
      summary={`${guests} ${guests === 1 ? 'guest' : 'guests'}`}
      onClose={onClose}
      confirmLabel="Choose table"
      onConfirm={() => onConfirm(sel)}
    >
      <button
        type="button"
        onClick={() => setSel('')}
        className={`w-full mb-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
          sel === '' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        No table (assign later)
      </button>
      <div className="space-y-4">
        {groups.map(([zoneKey, ztables]) => (
          <div key={zoneKey}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {zoneKey === '__none__' ? 'Unzoned' : zoneName(zoneKey)}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ztables.map((t) => {
                const selected = sel === t.id;
                const ok = fits(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSel(t.id)}
                    title={`${resourceLabel(restaurant, t)} · ${
                      t.minCapacity && t.minCapacity > 1 ? `${t.minCapacity}–` : ''
                    }${t.capacity} seats`}
                    className={`relative py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : ok
                          ? 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                          : 'border-slate-100 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block leading-tight">{t.number}</span>
                    <span className={`block text-[11px] font-normal ${selected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {t.minCapacity && t.minCapacity > 1 ? `${t.minCapacity}–${t.capacity}` : `${t.capacity}`} seats
                    </span>
                    {selected && <FiCheck size={12} className="absolute top-1 right-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!groups.length && <p className="text-sm text-slate-400 text-center py-6">No tables set up yet.</p>}
    </PickerShell>
  );
}
