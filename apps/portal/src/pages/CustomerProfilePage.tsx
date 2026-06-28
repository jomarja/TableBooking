import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiPhone,
  FiUser,
  FiMail,
  FiGift,
  FiTag,
  FiEdit2,
  FiMoreVertical,
  FiExternalLink,
  FiX,
  FiCopy,
  FiTrash2,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Reservation } from '../types';
import { statusBadge } from '../components/statusBadge';
import { ChannelIcon } from '../components/channel';
import { DatePicker } from '../components/DatePicker';
import { resourceLabel } from '../lib/resources';

const todayStr = () => new Date().toISOString().slice(0, 10);

type Customer = {
  name: string;
  surname: string;
  phone: string;
  occasion: string | null;
  customerNotes: string | null;
  staffNotes: string | null;
  totalVisits: number;
  email: string | null;
  birthday: string | null;
  company: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
};

type Tab = 'future' | 'past' | 'cancelled';

export default function CustomerProfilePage() {
  const { phone = '' } = useParams();
  const decodedPhone = decodeURIComponent(phone);
  const navigate = useNavigate();
  const { restaurant } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('future');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    email: '',
    birthday: '',
    company: '',
    address: '',
    tags: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.customerProfile(decodedPhone);
      setCustomer(data.customer);
      setReservations(data.reservations);
    } finally {
      setLoading(false);
    }
  }, [decodedPhone]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayStr();
  const buckets = useMemo(() => {
    const future: Reservation[] = [];
    const past: Reservation[] = [];
    const cancelled: Reservation[] = [];
    for (const r of reservations) {
      if (r.status === 'CANCELLED') cancelled.push(r);
      else if (r.date >= today) future.push(r);
      else past.push(r);
    }
    future.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    return { future, past, cancelled };
  }, [reservations, today]);

  const tableLabel = (r: Reservation) => {
    if (!r.tableId) return 'No table';
    const t = restaurant?.tables.find((x) => x.id === r.tableId);
    return t ? resourceLabel(restaurant, t) : '—';
  };

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusy(id);
    setMenuId(null);
    try {
      await fn();
      await load();
    } finally {
      setBusy(null);
    }
  };

  const openEditMeta = () => {
    setMetaForm({
      email: customer?.email ?? '',
      birthday: customer?.birthday ?? '',
      company: customer?.company ?? '',
      address: customer?.address ?? '',
      tags: (customer?.tags ?? []).join(', '),
      notes: customer?.notes ?? '',
    });
    setEditingMeta(true);
  };
  const saveMeta = async () => {
    await api.saveCustomerMeta(decodedPhone, {
      email: metaForm.email,
      birthday: metaForm.birthday,
      company: metaForm.company,
      address: metaForm.address,
      tags: metaForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: metaForm.notes,
    });
    setEditingMeta(false);
    await load();
  };

  const showInScheduler = (r: Reservation) => navigate(`/reservations?date=${r.date}&focus=${r.id}`);
  const cancelRes = (r: Reservation) => act(() => api.updateReservation(r.id, { status: 'CANCELLED' }), r.id);
  const deleteRes = (r: Reservation) => {
    if (!confirm('Delete this reservation? This cannot be undone.')) return;
    void act(() => api.deleteReservation(r.id), r.id);
  };
  const duplicateRes = (r: Reservation) =>
    act(
      () =>
        api.createReservation({
          name: r.name,
          surname: r.surname,
          phone: r.phone,
          guests: r.guests,
          tableId: r.tableId ?? undefined,
          date: r.date,
          startTime: r.startTime,
          endTime: r.endTime,
          occasion: r.occasion ?? undefined,
          customerNotes: r.customerNotes ?? undefined,
          channel: r.channel,
        }),
      r.id,
    );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'future', label: 'Future', count: buckets.future.length },
    { key: 'past', label: 'Past', count: buckets.past.length },
    { key: 'cancelled', label: 'Cancelled', count: buckets.cancelled.length },
  ];
  const rows = buckets[tab];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <FiArrowLeft /> Back
      </button>

      {/* Contact card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 relative">
        {customer && (
          <button
            onClick={openEditMeta}
            className="absolute top-4 right-4 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <FiEdit2 size={14} /> Edit details
          </button>
        )}
        {loading && !customer ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-bold shrink-0">
              {(customer?.name || decodedPhone || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800">
                {`${customer?.name ?? ''} ${customer?.surname ?? ''}`.trim() || 'Guest'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FiPhone size={13} /> {decodedPhone || '—'}
                </span>
                {customer?.email && (
                  <span className="flex items-center gap-1.5">
                    <FiMail size={13} /> {customer.email}
                  </span>
                )}
                {customer?.birthday && (
                  <span className="flex items-center gap-1.5">
                    <FiGift size={13} /> {customer.birthday}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <FiUser size={13} /> {customer?.totalVisits ?? 0} completed visits
                </span>
              </div>
              {(customer?.company || customer?.address) && (
                <p className="mt-1 text-sm text-slate-500">
                  {[customer?.company, customer?.address].filter(Boolean).join(' · ')}
                </p>
              )}
              {!!customer?.tags?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customer.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                      <FiTag size={10} /> {t}
                    </span>
                  ))}
                </div>
              )}
              {customer?.occasion && (
                <p className="mt-2 text-sm text-slate-600">
                  Occasion: <span className="font-medium">{customer.occasion}</span>
                </p>
              )}
              {(customer?.notes || customer?.staffNotes) && (
                <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Internal note: {customer?.notes || customer?.staffNotes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit details modal */}
      {editingMeta && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingMeta(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-slate-800">Edit customer details</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Email</span>
                <input className="tb-input" type="email" value={metaForm.email} onChange={(e) => setMetaForm({ ...metaForm, email: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 mb-1 block">Birthday</span>
                  <DatePicker
                    className="w-full"
                    ariaLabel="Birthday"
                    placeholder="Pick a date"
                    value={metaForm.birthday}
                    onChange={(v) => setMetaForm({ ...metaForm, birthday: v })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 mb-1 block">Company</span>
                  <input className="tb-input" value={metaForm.company} onChange={(e) => setMetaForm({ ...metaForm, company: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Address</span>
                <input className="tb-input" value={metaForm.address} onChange={(e) => setMetaForm({ ...metaForm, address: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Tags (comma-separated)</span>
                <input className="tb-input" placeholder="VIP, regular, allergy" value={metaForm.tags} onChange={(e) => setMetaForm({ ...metaForm, tags: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Internal notes</span>
                <textarea className="tb-input resize-none" rows={3} value={metaForm.notes} onChange={(e) => setMetaForm({ ...metaForm, notes: e.target.value })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingMeta(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => void saveMeta()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation history */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Reservation history</h3>
        </div>
        <div className="flex gap-1 px-3 pt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.label}{' '}
              <span className={tab === t.key ? 'text-indigo-200' : 'text-slate-400'}>({t.count})</span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No {tab} reservations.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 relative">
                <button onClick={() => showInScheduler(r)} className="text-left min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <ChannelIcon channel={r.channel} size={12} className="text-slate-400 shrink-0" />
                    {r.date} · {r.startTime}–{r.endTime}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.guests} guests · {tableLabel(r)}
                  </p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(r.status)}
                  <button
                    onClick={() => setMenuId(menuId === r.id ? null : r.id)}
                    disabled={busy === r.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Actions"
                  >
                    <FiMoreVertical size={16} />
                  </button>
                </div>
                {menuId === r.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                    <div className="absolute right-5 top-12 z-20 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-sm">
                      <button onClick={() => showInScheduler(r)} className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50">
                        <FiExternalLink size={14} /> Show in scheduler
                      </button>
                      <button onClick={() => duplicateRes(r)} className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50">
                        <FiCopy size={14} /> Duplicate
                      </button>
                      {r.status !== 'CANCELLED' && (
                        <button onClick={() => cancelRes(r)} className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50">
                          <FiX size={14} /> Cancel
                        </button>
                      )}
                      <button onClick={() => deleteRes(r)} className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50">
                        <FiTrash2 size={14} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
