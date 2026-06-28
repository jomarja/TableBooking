import { useEffect, useState, type ReactNode } from 'react';
import { FiSave, FiChevronDown, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { InfoTip } from '../components/InfoTip';
import { NumberField } from '../components/NumberField';
import { Select } from '../components/Select';
import type { FieldRequirement, SameDayCutoff } from '../types';

type Tab = 'defaults' | 'online' | 'required' | 'capacity' | 'notifications';

interface Settings {
  defaultDurationMinutes: number;
  intervalMinutes: number;
  durationByGuests: { maxGuests: number; minutes: number }[];
  onlineEnabled: boolean;
  approvalMode: 'auto' | 'manual' | 'hybrid';
  waitingList: boolean;
  minGroupSize: number;
  maxGroupSize: number;
  minLeadTimeMinutes: number;
  maxBookingWindowDays: number; // 0 = unlimited
  sameDayCutoff: SameDayCutoff;
  requiredFields: Record<'firstName' | 'lastName' | 'phone' | 'email' | 'address' | 'comments', FieldRequirement>;
  applyRequiredToWalkins: boolean;
  maxGuestsPerReservation: number;
  maxGuestsPerInterval: number; // 0 = unlimited
  maxReservationsPerInterval: number; // 0 = unlimited
  maxOnlineReservationsPerDay: number; // 0 = unlimited
  staffNotifyMode: 'never' | 'always' | 'online' | 'large';
  largeGroupThreshold: number;
  reservationNotice: string;
}

const DURATIONS = [60, 90, 120, 150, 180];
const INTERVALS = [15, 30, 60];
const LEAD_TIMES = [0, 30, 60, 90, 120];
const WINDOWS = [0, 30, 60, 90, 180];

const TABS: { key: Tab; label: string }[] = [
  { key: 'defaults', label: 'Defaults' },
  { key: 'online', label: 'Online reservations' },
  { key: 'required', label: 'Required fields' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'notifications', label: 'Notifications' },
];

const REQUIRED_FIELDS: { key: keyof Settings['requiredFields']; label: string }[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'comments', label: 'Comments' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700 flex items-center gap-1.5">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function ReservationSettingsPage() {
  const { restaurant, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('defaults');
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 'custom' keeps the custom-minutes field open even when the typed value
  // happens to equal a preset — so it never collapses while you're editing.
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');

  useEffect(() => {
    if (!restaurant) return;
    const rules = restaurant.reservationRules || ({} as NonNullable<typeof restaurant.reservationRules>);
    const cap = restaurant.capacityRules || ({} as NonNullable<typeof restaurant.capacityRules>);
    const policy = restaurant.reservationConfirmationPolicy || ({} as NonNullable<typeof restaurant.reservationConfirmationPolicy>);
    setS({
      defaultDurationMinutes: rules.defaultDurationMinutes ?? 90,
      intervalMinutes: rules.intervalMinutes ?? 15,
      durationByGuests: rules.durationByGuests ?? [],
      onlineEnabled: rules.onlineEnabled !== false,
      approvalMode: policy.approvalMode ?? (policy.autoConfirm ? 'auto' : 'manual'),
      waitingList: !!rules.waitingList,
      minGroupSize: rules.minGroupSize ?? 1,
      maxGroupSize: rules.maxGroupSize ?? restaurant.maxGuests ?? 20,
      minLeadTimeMinutes: rules.minLeadTimeMinutes ?? 0,
      maxBookingWindowDays: rules.maxBookingWindowDays ?? 0,
      sameDayCutoff: rules.sameDayCutoff ?? { mode: 'disabled' },
      requiredFields: {
        firstName: rules.requiredFields?.firstName ?? 'optional',
        lastName: rules.requiredFields?.lastName ?? 'required',
        phone: rules.requiredFields?.phone ?? 'required',
        email: rules.requiredFields?.email ?? 'optional',
        address: rules.requiredFields?.address ?? 'hidden',
        comments: rules.requiredFields?.comments ?? 'optional',
      },
      applyRequiredToWalkins: !!rules.applyRequiredToWalkins,
      maxGuestsPerReservation: cap.maxGuestsPerReservation ?? restaurant.maxGuests ?? 20,
      maxGuestsPerInterval: cap.maxGuestsPerInterval ?? 0,
      maxReservationsPerInterval: cap.maxReservationsPerTimeSlot ?? 0,
      maxOnlineReservationsPerDay: cap.maxOnlineReservationsPerDay ?? 0,
      staffNotifyMode: rules.staffNotifyMode ?? 'never',
      largeGroupThreshold: rules.largeGroupThreshold ?? 8,
      reservationNotice: rules.reservationNotice ?? '',
    });
    setDurationMode(DURATIONS.includes(rules.defaultDurationMinutes ?? 90) ? 'preset' : 'custom');
  }, [restaurant]);

  if (!restaurant || !s) return <div className="text-slate-400">Loading…</div>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const rules = restaurant.reservationRules || ({} as Record<string, unknown>);
      const cap = restaurant.capacityRules || ({} as Record<string, unknown>);
      const policy = restaurant.reservationConfirmationPolicy || ({} as Record<string, unknown>);
      await api.updateRestaurant(restaurant.id, {
        maxGuests: s.maxGuestsPerReservation,
        reservationRules: {
          ...rules,
          defaultDurationMinutes: s.defaultDurationMinutes,
          durationByGuests: s.durationByGuests,
          intervalMinutes: s.intervalMinutes,
          onlineEnabled: s.onlineEnabled,
          waitingList: s.waitingList,
          minGroupSize: s.minGroupSize,
          maxGroupSize: s.maxGroupSize,
          minLeadTimeMinutes: s.minLeadTimeMinutes,
          maxBookingWindowDays: s.maxBookingWindowDays || undefined,
          sameDayCutoff: s.sameDayCutoff,
          requiredFields: s.requiredFields,
          applyRequiredToWalkins: s.applyRequiredToWalkins,
          staffNotifyMode: s.staffNotifyMode,
          largeGroupThreshold: s.largeGroupThreshold,
          reservationNotice: s.reservationNotice,
        },
        reservationConfirmationPolicy: {
          ...policy,
          approvalMode: s.approvalMode,
          autoConfirm: s.approvalMode === 'auto',
        },
        capacityRules: {
          ...cap,
          maxGuestsPerReservation: s.maxGuestsPerReservation,
          maxReservationsPerTimeSlot: s.maxReservationsPerInterval || undefined,
          maxGuestsPerInterval: s.maxGuestsPerInterval || undefined,
          maxOnlineReservationsPerDay: s.maxOnlineReservationsPerDay || undefined,
        },
      } as never);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const card = 'bg-white rounded-xl border border-slate-200 p-5';

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reservation Settings</h2>
          <p className="text-slate-500 text-sm">Control how reservations work — durations, online rules, capacity and more.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            <FiSave /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setShowAdvanced(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Defaults ---- */}
      {tab === 'defaults' && (
        <div className={card}>
          <Row label="Default reservation duration" hint="The length new reservations get by default.">
            <Select
              className="w-44"
              ariaLabel="Default reservation duration"
              value={durationMode === 'custom' ? 'custom' : String(s.defaultDurationMinutes)}
              onChange={(v) => {
                if (v === 'custom') {
                  setDurationMode('custom');
                } else {
                  setDurationMode('preset');
                  set('defaultDurationMinutes', Number(v));
                }
              }}
              options={[
                ...DURATIONS.map((d) => ({ value: String(d), label: `${d} minutes` })),
                { value: 'custom', label: 'Custom…' },
              ]}
            />
          </Row>
          {durationMode === 'custom' && (
            <Row label="Custom duration (minutes)">
              <NumberField
                className={selectCls + ' w-28'}
                min={15}
                step={15}
                value={s.defaultDurationMinutes}
                onChange={(n) => set('defaultDurationMinutes', n)}
              />
            </Row>
          )}
          <Row label="Reservation interval" hint="Controls how often customers can start reservations (e.g. every 15 min → 18:00, 18:15, 18:30).">
            <Select
              className="w-44"
              ariaLabel="Reservation interval"
              value={String(s.intervalMinutes)}
              onChange={(v) => set('intervalMinutes', Number(v))}
              options={INTERVALS.map((i) => ({ value: String(i), label: `${i} minutes` }))}
            />
          </Row>

          <button onClick={() => setShowAdvanced((v) => !v)} className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-600">
            {showAdvanced ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />} Duration by party size
            <InfoTip text="Give larger parties a longer default duration. Smaller parties use the shorter time." />
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2">
              {s.durationByGuests.length === 0 && (
                <p className="text-xs text-slate-400">No rules yet — the default duration applies to all party sizes.</p>
              )}
              {s.durationByGuests.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Up to</span>
                  <NumberField className={selectCls + ' w-20'} min={1} value={r.maxGuests} onChange={(n) => set('durationByGuests', s.durationByGuests.map((x, j) => j === i ? { ...x, maxGuests: n } : x))} />
                  <span className="text-slate-500">guests →</span>
                  <NumberField className={selectCls + ' w-24'} min={15} step={15} value={r.minutes} onChange={(n) => set('durationByGuests', s.durationByGuests.map((x, j) => j === i ? { ...x, minutes: n } : x))} />
                  <span className="text-slate-500">min</span>
                  <button onClick={() => set('durationByGuests', s.durationByGuests.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => set('durationByGuests', [...s.durationByGuests, { maxGuests: 6, minutes: 120 }])} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                <FiPlus size={14} /> Add rule
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- Online ---- */}
      {tab === 'online' && (
        <div className={card}>
          <Row label="Enable online reservations" hint="When off, the restaurant stays visible but customers can't book online.">
            <Toggle checked={s.onlineEnabled} onChange={(v) => set('onlineEnabled', v)} />
          </Row>
          <div className="py-3.5 border-b border-slate-100">
            <p className="text-sm text-slate-700 mb-2 flex items-center gap-1.5">Confirmation mode <InfoTip text="Automatic confirms instantly. Manual approval sends bookings to your dashboard to accept or reject." /></p>
            <div className="space-y-1.5">
              {[
                { v: 'auto' as const, label: 'Automatic — confirm instantly', desc: 'Reservations become CONFIRMED right away.' },
                { v: 'manual' as const, label: 'Manual approval', desc: 'Reservations arrive as PENDING in the dashboard queue.' },
                { v: 'hybrid' as const, label: 'Hybrid (coming soon)', desc: 'Auto-confirm when capacity allows, otherwise ask for approval.', disabled: true },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-start gap-2 p-2 rounded-lg border ${s.approvalMode === opt.v ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'} ${opt.disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" name="approval" className="mt-0.5" disabled={opt.disabled} checked={s.approvalMode === opt.v} onChange={() => set('approvalMode', opt.v)} />
                  <span>
                    <span className="text-sm font-medium text-slate-700 block">{opt.label}</span>
                    <span className="text-xs text-slate-500">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Row label="Waiting list" hint="Let guests join a waiting list when fully booked (notifications coming soon).">
            <Toggle checked={s.waitingList} onChange={(v) => set('waitingList', v)} />
          </Row>
          <Row label="Minimum group size">
            <NumberField className={selectCls + ' w-24'} min={1} value={s.minGroupSize} onChange={(n) => set('minGroupSize', n)} />
          </Row>
          <Row label="Maximum group size" hint="Larger parties see a message to contact the restaurant directly.">
            <NumberField className={selectCls + ' w-24'} min={1} value={s.maxGroupSize} onChange={(n) => set('maxGroupSize', n)} />
          </Row>

          <button onClick={() => setShowAdvanced((v) => !v)} className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-600">
            {showAdvanced ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />} Advanced timing rules
          </button>
          {showAdvanced && (
            <div className="mt-1">
              <Row label="Minimum lead time" hint="Prevents last-minute bookings the kitchen can't prepare for.">
                <Select
                  className="w-44"
                  ariaLabel="Minimum lead time"
                  value={String(s.minLeadTimeMinutes)}
                  onChange={(v) => set('minLeadTimeMinutes', Number(v))}
                  options={LEAD_TIMES.map((m) => ({ value: String(m), label: m === 0 ? 'No minimum' : `${m} minutes` }))}
                />
              </Row>
              <Row label="Maximum booking window" hint="How far in advance guests can book.">
                <Select
                  className="w-44"
                  ariaLabel="Maximum booking window"
                  value={String(s.maxBookingWindowDays)}
                  onChange={(v) => set('maxBookingWindowDays', Number(v))}
                  options={WINDOWS.map((d) => ({ value: String(d), label: d === 0 ? 'Unlimited' : `${d} days` }))}
                />
              </Row>
              <Row label="Same-day cutoff" hint="Stop accepting same-day online bookings after a time, or a number of hours before closing.">
                <div className="flex items-center gap-2">
                  <Select
                    className="w-40"
                    ariaLabel="Same-day cutoff mode"
                    value={s.sameDayCutoff.mode}
                    onChange={(v) => set('sameDayCutoff', { ...s.sameDayCutoff, mode: v as SameDayCutoff['mode'] })}
                    options={[
                      { value: 'disabled', label: 'No cutoff' },
                      { value: 'time', label: 'After a time' },
                      { value: 'beforeClose', label: 'Before closing' },
                    ]}
                  />
                  {s.sameDayCutoff.mode === 'time' && (
                    <input type="time" className={selectCls} value={s.sameDayCutoff.time || '20:00'} onChange={(e) => set('sameDayCutoff', { ...s.sameDayCutoff, time: e.target.value })} />
                  )}
                  {s.sameDayCutoff.mode === 'beforeClose' && (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <NumberField className={selectCls + ' w-20'} min={0} value={s.sameDayCutoff.hoursBeforeClose ?? 2} onChange={(n) => set('sameDayCutoff', { ...s.sameDayCutoff, hoursBeforeClose: n })} /> hrs before
                    </span>
                  )}
                </div>
              </Row>
            </div>
          )}
        </div>
      )}

      {/* ---- Required fields ---- */}
      {tab === 'required' && (
        <div className={card}>
          <p className="text-sm text-slate-500 mb-2">
            Choose which fields appear and which are mandatory when creating a reservation.
          </p>
          {REQUIRED_FIELDS.map((f) => (
            <Row key={f.key} label={f.label}>
              <Select
                className="w-40"
                ariaLabel={f.label}
                value={s.requiredFields[f.key]}
                onChange={(v) => set('requiredFields', { ...s.requiredFields, [f.key]: v as FieldRequirement })}
                options={[
                  { value: 'hidden', label: 'Hidden' },
                  { value: 'optional', label: 'Optional' },
                  { value: 'required', label: 'Required' },
                ]}
              />
            </Row>
          ))}
          <Row label="Apply to walk-ins" hint="When on, these rules also apply to walk-in reservations entered by staff.">
            <Toggle checked={s.applyRequiredToWalkins} onChange={(v) => set('applyRequiredToWalkins', v)} />
          </Row>
        </div>
      )}

      {/* ---- Capacity ---- */}
      {tab === 'capacity' && (
        <div className={card}>
          <Row label="Maximum guests per reservation" hint="The largest party a single reservation can have.">
            <NumberField className={selectCls + ' w-24'} min={1} value={s.maxGuestsPerReservation} onChange={(n) => set('maxGuestsPerReservation', n)} />
          </Row>
          <Row label="Max guests per interval" hint="Prevents all tables from filling at the same time. 0 = unlimited.">
            <NumberField className={selectCls + ' w-24'} min={0} value={s.maxGuestsPerInterval} onChange={(n) => set('maxGuestsPerInterval', n)} />
          </Row>
          <Row label="Max reservations per interval" hint="Caps how many separate bookings can start in the same interval. 0 = unlimited.">
            <NumberField className={selectCls + ' w-24'} min={0} value={s.maxReservationsPerInterval} onChange={(n) => set('maxReservationsPerInterval', n)} />
          </Row>
          <Row label="Max online reservations per day" hint="Caps self-service online bookings per day; staff can always add more manually. 0 = unlimited.">
            <NumberField className={selectCls + ' w-24'} min={0} value={s.maxOnlineReservationsPerDay} onChange={(n) => set('maxOnlineReservationsPerDay', n)} />
          </Row>
        </div>
      )}

      {/* ---- Notifications ---- */}
      {tab === 'notifications' && (
        <div className={card}>
          <Row label="Notify staff about reservations">
            <Select
              className="w-52"
              ariaLabel="Notify staff about reservations"
              value={s.staffNotifyMode}
              onChange={(v) => set('staffNotifyMode', v as Settings['staffNotifyMode'])}
              options={[
                { value: 'never', label: 'Never' },
                { value: 'always', label: 'Always' },
                { value: 'online', label: 'Online reservations only' },
                { value: 'large', label: 'Large groups only' },
              ]}
            />
          </Row>
          {s.staffNotifyMode === 'large' && (
            <Row label="Large group threshold" hint="Only notify for reservations at or above this guest count.">
              <NumberField className={selectCls + ' w-24'} min={1} value={s.largeGroupThreshold} onChange={(n) => set('largeGroupThreshold', n)} />
            </Row>
          )}
          <div className="py-3.5">
            <p className="text-sm text-slate-700 mb-1.5 flex items-center gap-1.5">Reservation notice <InfoTip text="Shown to staff while creating a reservation — e.g. 'Birthday — offer complimentary dessert.'" /></p>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="e.g. VIP customer arriving today."
              value={s.reservationNotice}
              onChange={(e) => set('reservationNotice', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
