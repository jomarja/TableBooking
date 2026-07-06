import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiX, FiInbox, FiChevronRight, FiUser } from 'react-icons/fi';
import { api } from '../api/client';
import type { Reservation, Restaurant } from '../types';
import { ChannelIcon } from './channel';
import { resourceLabel } from '../lib/resources';

const DECLINE_REASONS = ['Restaurant Full', 'Private Event', 'Kitchen Closed'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function channelLabel(c: string): string {
  return c === 'ONLINE' ? 'Online' : c === 'PHONE' ? 'Phone' : 'Walk-in';
}

interface Props {
  pending: Reservation[];
  restaurant: Restaurant | null;
  onChanged: () => Promise<void> | void;
}

/** Dashboard approval queue: online bookings land here as PENDING and staff
 *  Accept (→ CONFIRMED) or Decline (→ CANCELLED with a reason). */
export function OnlineReservationsQueue({ pending, restaurant, onChanged }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Reservation | null>(null);
  const [customReason, setCustomReason] = useState('');

  const tableLabel = (r: Reservation) => {
    if (!r.tableId) return 'No table yet';
    const t = restaurant?.tables.find((x) => x.id === r.tableId);
    return t ? resourceLabel(restaurant, t) : '—';
  };

  const accept = async (r: Reservation) => {
    setBusy(r.id);
    try {
      await api.updateReservation(r.id, { status: 'CONFIRMED' });
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const submitDecline = async (reason: string) => {
    if (!declining || !reason.trim()) return;
    const r = declining;
    setBusy(r.id);
    try {
      await api.updateReservation(r.id, { status: 'CANCELLED', staffNotes: `Declined: ${reason.trim()}` });
      setDeclining(null);
      setCustomReason('');
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const showInScheduler = (r: Reservation) =>
    navigate(`/reservations?date=${r.date}&focus=${r.id}`);
  const openProfile = (r: Reservation) =>
    r.phone && navigate(`/customers/${encodeURIComponent(r.phone)}`);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FiInbox className="text-indigo-500" /> Online Reservations
          {pending.length > 0 && (
            <span className="text-xs font-semibold bg-indigo-600 text-white rounded-full px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </h3>
        <span className="text-xs text-slate-400">awaiting your approval</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto tb-scroll">
        {pending.length === 0 ? (
          <p className="px-5 py-8 text-center text-slate-400 text-sm">
            No reservations waiting for approval. You're all caught up. 🎉
          </p>
        ) : (
          pending.map((r) => (
            <div key={r.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-indigo-50/40 transition-colors">
              {/* Row body → scheduler (same contract as every dashboard list) */}
              <button
                onClick={() => showInScheduler(r)}
                className="group text-left min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
                title="Show in scheduler"
              >
                <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
                  <ChannelIcon channel={r.channel} size={12} className="shrink-0 text-slate-400" />
                  {r.name} {r.surname}
                  <span className="font-normal text-slate-400">· {r.guests} guests</span>
                  <FiChevronRight
                    size={13}
                    className="shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors"
                  />
                </p>
                <p className="text-xs text-slate-500">
                  {r.date} · {r.startTime}–{r.endTime} · {tableLabel(r)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {channelLabel(r.channel)} · created {timeAgo(r.createdAt)}
                </p>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => accept(r)}
                  disabled={busy === r.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  <FiCheck size={14} /> Accept
                </button>
                <button
                  onClick={() => setDeclining(r)}
                  disabled={busy === r.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-60"
                >
                  <FiX size={14} /> Decline
                </button>
                {r.phone && (
                  <button
                    onClick={() => openProfile(r)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Customer profile"
                  >
                    <FiUser size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Decline reason modal */}
      {declining && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDeclining(null);
              setCustomReason('');
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800">Decline reservation</h3>
            <p className="mt-1 text-sm text-slate-500">
              {declining.name} {declining.surname} · {declining.date} {declining.startTime}
            </p>
            <p className="mt-4 text-xs font-medium text-slate-600">Reason</p>
            <div className="mt-2 space-y-2">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => submitDecline(reason)}
                  disabled={busy === declining.id}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-red-300 hover:bg-red-50 disabled:opacity-60"
                >
                  {reason}
                </button>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Custom reason…"
                  className="tb-input flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && submitDecline(customReason)}
                />
                <button
                  onClick={() => submitDecline(customReason)}
                  disabled={!customReason.trim() || busy === declining.id}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => {
                  setDeclining(null);
                  setCustomReason('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
