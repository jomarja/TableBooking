import { useEffect, useRef, useState } from 'react';
import {
  FiX,
  FiTrash2,
  FiUsers,
  FiPhone,
  FiMapPin,
  FiCalendar,
  FiClock,
  FiChevronRight,
  FiChevronDown,
  FiRotateCcw,
  FiRotateCw,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Reservation, ReservationChannel, ReservationStatus, TableModel } from '../types';
import { statusBadge } from './statusBadge';
import { RESERVATION_CHANNELS, channelMeta } from './channel';
import { resourceLabel } from '../lib/resources';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { TimePickerDialog, GuestPickerDialog, TablePickerDialog } from './reservationPickers';

interface Props {
  reservation: Reservation | null; // null = create
  tables: TableModel[];
  date: string;
  initial?: { tableId: string; startTime: string };
  defaultDuration?: number;
  onClose: () => void;
  onSaved: (
    notify: boolean,
    id?: string,
    history?: { before: Partial<Reservation>; after: Partial<Reservation> },
  ) => void;
}

type FormState = {
  name: string;
  surname: string;
  phone: string;
  guests: number;
  tableId: string;
  date: string;
  startTime: string;
  endTime: string;
  occasion: string;
  customerNotes: string;
  staffNotes: string;
  status: ReservationStatus;
  channel: ReservationChannel;
};

// Module-level clipboard so a copied reservation survives modal close (Ctrl+C / Ctrl+V).
let copiedReservation: FormState | null = null;

const OCCASIONS = ['Birthday', 'Anniversary', 'Graduation', 'Business Meeting', 'Date Night', 'Other'];

// One-click status actions. "Arrived" = SEATED.
const STATUS_ACTIONS: { label: string; value: ReservationStatus; active: string }[] = [
  { label: 'Pending', value: 'PENDING', active: 'bg-orange-500 text-white border-orange-500' },
  { label: 'Confirmed', value: 'CONFIRMED', active: 'bg-indigo-600 text-white border-indigo-600' },
  { label: 'Arrived', value: 'SEATED', active: 'bg-amber-400 text-amber-950 border-amber-400' },
  { label: 'Completed', value: 'COMPLETED', active: 'bg-slate-500 text-white border-slate-500' },
  { label: 'Cancelled', value: 'CANCELLED', active: 'bg-slate-400 text-white border-slate-400 line-through' },
];
const DURATION_ADDS = [30, 60, 90, 120];

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function pad(n: number) {
  return String(n).padStart(2, '0');
}
function addMinutes(time: string, minutes: number) {
  let total = toMin(time) + minutes;
  total = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
function diffMinutes(start: string, end: string) {
  let d = toMin(end) - toMin(start);
  if (d <= 0) d += 1440; // overnight
  return d;
}
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function shortDate(dStr: string) {
  return new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ReservationModal({
  reservation,
  tables,
  date,
  initial,
  defaultDuration = 120,
  onClose,
  onSaved,
}: Props) {
  const { restaurant } = useAuth();
  const isEdit = !!reservation;

  const buildInitial = (): FormState => ({
    name: reservation?.name || '',
    surname: reservation?.surname || '',
    phone: reservation?.phone || '',
    guests: reservation?.guests || 2,
    tableId: reservation?.tableId || initial?.tableId || tables[0]?.id || '',
    date: reservation?.date || date,
    startTime: reservation?.startTime || initial?.startTime || '19:00',
    endTime:
      reservation?.endTime || (initial ? addMinutes(initial.startTime, defaultDuration) : '21:00'),
    occasion: reservation?.occasion || '',
    customerNotes: reservation?.customerNotes || '',
    staffNotes: reservation?.staffNotes || '',
    status: (reservation?.status || 'CONFIRMED') as ReservationStatus,
    channel: (reservation?.channel || (isEdit ? 'ONLINE' : 'WALK_IN')) as ReservationChannel,
  });

  // Edit history (undo/redo). `lastKey` coalesces consecutive edits to the same
  // field (e.g. typing a name) into one undo step.
  const [hist, setHist] = useState<{ stack: FormState[]; index: number; lastKey: string | null }>(
    () => ({ stack: [buildInitial()], index: 0, lastKey: null }),
  );
  const form = hist.stack[hist.index];
  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.stack.length - 1;

  const apply = (patch: Partial<FormState>, coalesceKey: string | null = null) => {
    setHist((h) => {
      const cur = h.stack[h.index];
      const next = { ...cur, ...patch };
      if (Object.keys(patch).every((k) => (cur as never)[k] === (next as never)[k])) return h;
      let stack = h.stack.slice(0, h.index + 1);
      if (coalesceKey && coalesceKey === h.lastKey) stack = stack.slice(0, -1);
      stack = [...stack, next];
      return { stack, index: stack.length - 1, lastKey: coalesceKey };
    });
  };
  const undo = () => setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1, lastKey: null } : h));
  const redo = () =>
    setHist((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1, lastKey: null } : h));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notesOpen, setNotesOpen] = useState(
    () => !!(reservation?.customerNotes || reservation?.staffNotes),
  );
  const [flash, setFlash] = useState('');
  // Which rich picker overlay is open (time / guests / table), if any.
  const [picker, setPicker] = useState<'time' | 'guests' | 'table' | null>(null);
  const pickerRef = useRef<'time' | 'guests' | 'table' | null>(null);
  pickerRef.current = picker;

  const table = tables.find((t) => t.id === form.tableId);
  const resourceText = table ? resourceLabel(restaurant, table) : 'No resource';
  const duration = diffMinutes(form.startTime, form.endTime);
  const notesCount = (form.customerNotes.trim() ? 1 : 0) + (form.staffNotes.trim() ? 1 : 0);
  const fullName = `${form.name} ${form.surname}`.trim() || 'New reservation';

  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 1500);
  };

  // Diff the original reservation against the edited form so the scheduler can
  // record one undoable history entry for everything changed in the modal.
  const buildHistory = (): { before: Partial<Reservation>; after: Partial<Reservation> } | undefined => {
    if (!reservation) return undefined;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const norm = (k: string, v: unknown) =>
      k === 'tableId' ? (v || null) : k === 'guests' ? v : (v ?? '');
    (['date', 'startTime', 'endTime', 'tableId', 'status', 'guests', 'name', 'surname', 'phone', 'occasion', 'customerNotes', 'staffNotes', 'channel'] as const).forEach((k) => {
      const a = norm(k, (reservation as unknown as Record<string, unknown>)[k]);
      const b = norm(k, (form as unknown as Record<string, unknown>)[k]);
      if (a !== b) {
        before[k] = a;
        after[k] = b;
      }
    });
    return Object.keys(after).length ? { before, after } : undefined;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const history = buildHistory();
        const res = await api.updateReservation(reservation!.id, form);
        onSaved(res.notifyCustomer, reservation!.id, history);
      } else {
        await api.createReservation(form);
        onSaved(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  const duplicate = async () => {
    setSaving(true);
    setError('');
    try {
      await api.createReservation({ ...form, status: 'PENDING' });
      onSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate');
      setSaving(false);
    }
  };

  const cancelReservation = async () => {
    if (!reservation) return;
    if (!confirm('Cancel this reservation? It stays visible (struck-through) for your records.')) return;
    setSaving(true);
    setError('');
    try {
      const wasNot = reservation.status !== 'CANCELLED';
      const res = await api.updateReservation(reservation.id, { status: 'CANCELLED' });
      onSaved(
        res.notifyCustomer,
        reservation.id,
        wasNot ? { before: { status: reservation.status }, after: { status: 'CANCELLED' } } : undefined,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
      setSaving(false);
    }
  };

  // Keyboard workflow — bound once, always reads latest actions via ref.
  const actions = useRef<Record<string, () => void>>({});
  actions.current = {
    save,
    duplicate,
    undo,
    redo,
    close: onClose,
    copy: () => {
      copiedReservation = { ...form };
      flashMsg('Reservation copied');
    },
    paste: () => {
      if (copiedReservation) {
        apply({ ...copiedReservation });
        flashMsg('Pasted from copied reservation');
      }
    },
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = actions.current;
      const target = e.target as HTMLElement;
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      // A rich picker overlay owns the keyboard while open: Esc closes it (not
      // the whole modal), and modal shortcuts are suppressed.
      if (pickerRef.current) {
        if (e.key === 'Escape') { e.preventDefault(); setPicker(null); }
        return;
      }
      if (e.key === 'Escape') { a.close(); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? a.redo() : a.undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); a.redo(); return; }
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); a.duplicate(); return; }
      // Copy/paste only when not editing field text (so native copy still works there).
      if (mod && (e.key === 'c' || e.key === 'C') && !inField) { e.preventDefault(); a.copy(); return; }
      if (mod && (e.key === 'v' || e.key === 'V') && !inField) { e.preventDefault(); a.paste(); return; }
      if (e.key === 'Enter' && target.tagName !== 'TEXTAREA') { e.preventDefault(); a.save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-bold text-slate-800">
            {isEdit ? 'Reservation' : 'New Reservation'}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
            >
              <FiRotateCcw size={15} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
            >
              <FiRotateCw size={15} />
            </button>
            <button onClick={onClose} title="Close (Esc)" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Summary card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold text-slate-800 leading-tight">{fullName}</p>
              {statusBadge(form.status)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><FiUsers size={14} className="text-slate-400" /> {form.guests} {form.guests === 1 ? 'guest' : 'guests'}</span>
              {form.phone && <span className="inline-flex items-center gap-1.5"><FiPhone size={14} className="text-slate-400" /> {form.phone}</span>}
              <span className="inline-flex items-center gap-1.5"><FiMapPin size={14} className="text-slate-400" /> {resourceText}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><FiCalendar size={14} className="text-slate-400" /> {shortDate(form.date)}</span>
              <span className="inline-flex items-center gap-1.5"><FiClock size={14} className="text-slate-400" /> {form.startTime} → {form.endTime}</span>
              <span className="text-slate-500">Duration: <span className="font-medium text-slate-700">{fmtDuration(duration)}</span></span>
            </div>
            {isEdit && reservation?.lastEditedBy && (
              <p className="mt-2 text-xs text-slate-400">Last edited by {reservation.lastEditedBy}</p>
            )}
          </div>

          {/* Status quick actions */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_ACTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => apply({ status: s.value })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.status === s.value
                      ? s.active
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Guest + contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input className="tb-input" value={form.name} onChange={(e) => apply({ name: e.target.value }, 'name')} />
            </Field>
            <Field label="Surname">
              <input className="tb-input" value={form.surname} onChange={(e) => apply({ surname: e.target.value }, 'surname')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className="tb-input" value={form.phone} onChange={(e) => apply({ phone: e.target.value }, 'phone')} />
            </Field>
            <Field label="Guests">
              <button
                type="button"
                onClick={() => setPicker('guests')}
                className="tb-input w-full flex items-center justify-between text-left"
              >
                <span>{form.guests} {form.guests === 1 ? 'guest' : 'guests'}</span>
                <FiUsers size={15} className="text-slate-400" />
              </button>
            </Field>
          </div>

          {/* Resource */}
          <Field label="Resource / table">
            <button
              type="button"
              onClick={() => setPicker('table')}
              className="tb-input w-full flex items-center justify-between text-left"
            >
              <span className="truncate">{resourceText}</span>
              <FiMapPin size={15} className="text-slate-400 shrink-0" />
            </button>
          </Field>

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker
                value={form.date}
                onChange={(v) => apply({ date: v })}
                className="w-full"
                ariaLabel="Reservation date"
              />
            </Field>
            <Field label="Time">
              <button
                type="button"
                onClick={() => setPicker('time')}
                className="tb-input w-full flex items-center justify-between text-left"
              >
                <span>{form.startTime} → {form.endTime}</span>
                <FiClock size={15} className="text-slate-400" />
              </button>
            </Field>
          </div>

          {/* Duration shortcuts */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Extend:</span>
            {DURATION_ADDS.map((n) => (
              <button
                key={n}
                onClick={() => apply({ endTime: addMinutes(form.endTime, n) })}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 text-xs font-medium"
              >
                +{n}m
              </button>
            ))}
          </div>

          {/* Occasion + channel */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Occasion">
              <Select
                className="w-full"
                ariaLabel="Occasion"
                value={form.occasion}
                onChange={(v) => apply({ occasion: v })}
                options={[
                  { value: '', label: '—' },
                  ...OCCASIONS.map((o) => ({ value: o, label: o })),
                ]}
              />
            </Field>
            <Field label="Booking channel">
              <Select
                className="w-full"
                ariaLabel="Booking channel"
                value={form.channel}
                onChange={(v) => apply({ channel: v as ReservationChannel })}
                options={RESERVATION_CHANNELS.map((c) => ({ value: c, label: channelMeta(c).label }))}
              />
            </Field>
          </div>

          {/* Notes (collapsed by default) */}
          <div className="rounded-xl border border-slate-200">
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700"
            >
              <span>Notes ({notesCount})</span>
              {notesOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
            </button>
            {notesOpen && (
              <div className="px-3 pb-3 space-y-3">
                <Field label="Customer notes">
                  <textarea className="tb-input" rows={2} value={form.customerNotes} onChange={(e) => apply({ customerNotes: e.target.value }, 'customerNotes')} />
                </Field>
                <Field label="Internal staff notes (never shown to customer)">
                  <textarea className="tb-input bg-amber-50" rows={2} value={form.staffNotes} onChange={(e) => apply({ staffNotes: e.target.value }, 'staffNotes')} placeholder="VIP customer, allergy, manager approval…" />
                </Field>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Sticky footer — always visible */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0">
          {isEdit && form.status !== 'CANCELLED' ? (
            <button onClick={cancelReservation} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium">
              <FiTrash2 size={15} /> Cancel reservation
            </button>
          ) : (
            <span className="text-xs text-slate-400">{flash}</span>
          )}
          <div className="flex items-center gap-2">
            {flash && (isEdit && form.status !== 'CANCELLED') && <span className="text-xs text-emerald-600">{flash}</span>}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Close
            </button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Rich pickers — open on tapping the Time / Guests / Table fields */}
      {picker === 'time' && (
        <TimePickerDialog
          startTime={form.startTime}
          endTime={form.endTime}
          openingTime={restaurant?.openingTime || '10:00'}
          closingTime={restaurant?.closingTime || '23:00'}
          defaultDuration={defaultDuration}
          onConfirm={(s, e) => {
            apply({ startTime: s, endTime: e });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'guests' && (
        <GuestPickerDialog
          value={form.guests}
          max={restaurant?.capacityRules?.maxGuestsPerReservation ?? restaurant?.maxGuests}
          onConfirm={(n) => {
            apply({ guests: n });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'table' && (
        <TablePickerDialog
          tables={tables}
          restaurant={restaurant}
          value={form.tableId}
          guests={form.guests}
          onConfirm={(id) => {
            apply({ tableId: id });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
