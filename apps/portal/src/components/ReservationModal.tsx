import { useState } from 'react';
import { FiX, FiTrash2, FiUserCheck, FiLogOut, FiBell } from 'react-icons/fi';
import { api } from '../api/client';
import type { Reservation, ReservationChannel, ReservationStatus, TableModel } from '../types';
import { RESERVATION_STATUSES } from './statusBadge';
import { RESERVATION_CHANNELS, channelMeta } from './channel';

interface Props {
  reservation: Reservation | null; // null = create
  tables: TableModel[];
  date: string;
  // prefill for create mode (e.g. double-clicking a timeline slot)
  initial?: { tableId: string; startTime: string };
  defaultDuration?: number; // minutes; used to derive end time from start
  onClose: () => void;
  onSaved: (notify: boolean, id?: string) => void;
}

// add `minutes` to an "HH:MM" string, clamped to 23:59
function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  const isEdit = !!reservation;
  const [form, setForm] = useState({
    name: reservation?.name || '',
    surname: reservation?.surname || '',
    phone: reservation?.phone || '',
    guests: reservation?.guests || 2,
    tableId: reservation?.tableId || initial?.tableId || tables[0]?.id || '',
    date: reservation?.date || date,
    startTime: reservation?.startTime || initial?.startTime || '19:00',
    endTime:
      reservation?.endTime ||
      (initial ? addMinutes(initial.startTime, defaultDuration) : '21:00'),
    occasion: reservation?.occasion || '',
    customerNotes: reservation?.customerNotes || '',
    staffNotes: reservation?.staffNotes || '',
    status: (reservation?.status || 'CONFIRMED') as ReservationStatus,
    // New manual bookings default to walk-in; existing ones keep their channel.
    channel: (reservation?.channel || (isEdit ? 'ONLINE' : 'WALK_IN')) as ReservationChannel,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const res = await api.updateReservation(reservation!.id, form);
        onSaved(res.notifyCustomer, reservation!.id);
      } else {
        await api.createReservation(form);
        onSaved(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  // Quick status change (arrived → SEATED, left → COMPLETED) without leaving
  // the modal.
  const setStatusQuick = async (status: ReservationStatus) => {
    if (!reservation) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.updateReservation(reservation.id, { status });
      onSaved(res.notifyCustomer, reservation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!reservation) return;
    if (!confirm('Cancel and archive this reservation?')) return;
    setSaving(true);
    await api.deleteReservation(reservation.id);
    onSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Edit Reservation' : 'Manual Reservation'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input className="tb-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Surname">
              <input className="tb-input" value={form.surname} onChange={(e) => set('surname', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className="tb-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Guests">
              <input
                type="number"
                min={1}
                className="tb-input"
                value={form.guests}
                onChange={(e) => set('guests', Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Table">
            <select className="tb-input" value={form.tableId} onChange={(e) => set('tableId', e.target.value)}>
              <option value="">— No table —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} ({t.capacity} seats)
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" className="tb-input" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Start">
              <input type="time" className="tb-input" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
            <Field label="End">
              <input type="time" className="tb-input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Occasion">
              <select className="tb-input" value={form.occasion} onChange={(e) => set('occasion', e.target.value)}>
                <option value="">—</option>
                {['Birthday', 'Anniversary', 'Graduation', 'Business Meeting', 'Date Night', 'Other'].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className="tb-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {RESERVATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Booking channel">
              <select className="tb-input" value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                {RESERVATION_CHANNELS.map((c) => (
                  <option key={c} value={c}>{channelMeta(c).label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Customer notes">
            <textarea className="tb-input" rows={2} value={form.customerNotes} onChange={(e) => set('customerNotes', e.target.value)} />
          </Field>

          <Field label="Internal staff notes (never shown to customer)">
            <textarea
              className="tb-input bg-amber-50"
              rows={2}
              value={form.staffNotes}
              onChange={(e) => set('staffNotes', e.target.value)}
              placeholder="VIP customer, allergy, manager approval…"
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          {isEdit ? (
            <button onClick={remove} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium">
              <FiTrash2 size={16} /> Cancel reservation
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {isEdit && form.status === 'PENDING' && (
              <button
                onClick={() => setStatusQuick('CONFIRMED')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium hover:bg-indigo-200 disabled:opacity-60"
                title="Confirm reservation (notify the customer first)"
              >
                <FiBell size={16} /> Confirm
              </button>
            )}
            {isEdit && !['SEATED', 'COMPLETED', 'CANCELLED'].includes(form.status) && (
              <button
                onClick={() => setStatusQuick('SEATED')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-amber-950 text-sm font-medium hover:bg-amber-500 disabled:opacity-60"
                title="Mark guest as arrived (seated)"
              >
                <FiUserCheck size={16} /> Arrived
              </button>
            )}
            {isEdit && form.status === 'SEATED' && (
              <button
                onClick={() => setStatusQuick('COMPLETED')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 disabled:opacity-60"
                title="Mark guest as left (completed)"
              >
                <FiLogOut size={16} /> Person left
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Close
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
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
