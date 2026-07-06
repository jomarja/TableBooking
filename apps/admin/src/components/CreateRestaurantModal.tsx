import { useState } from 'react';
import { FiRefreshCw, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { NumberField } from './NumberField';
import { Select } from './Select';
import { tempPassword } from '../lib/tempPassword';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRestaurantModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState(() => ({
    name: '',
    cuisine: 'georgian',
    address: '',
    ownerEmail: '',
    ownerName: '',
    // Strong auto-generated temp password — the owner changes it on first login.
    ownerPassword: tempPassword(),
  }));
  const [rating, setRating] = useState(0);
  const [priceRange, setPriceRange] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    setError('');
    if (!form.name || !form.ownerEmail) {
      setError('Name and owner email are required.');
      return;
    }
    if (form.ownerPassword.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.createRestaurant({ ...form, rating, priceRange });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Create Restaurant Account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Creates a restaurant in <strong>PENDING</strong> status plus a staff login. The owner
            completes setup on first login. Restaurants cannot self-register.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Restaurant name *"><input className="tb-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Cuisine">
              <Select
                className="w-full"
                ariaLabel="Cuisine"
                value={form.cuisine}
                onChange={(v) => set('cuisine', v)}
                options={['georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza', 'burgers', 'vegan'].map((c) => ({ value: c, label: c }))}
              />
            </Field>
          </div>
          <Field label="Address"><input className="tb-input" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rating (0–5)">
              <NumberField className="tb-input" min={0} max={5} step={0.1} value={rating} onChange={setRating} />
            </Field>
            <Field label="Price range">
              <input className="tb-input" placeholder="e.g. ₾30-₾60" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} />
            </Field>
          </div>

          <hr className="border-slate-100" />
          <p className="text-xs font-semibold text-slate-500 uppercase">Owner account</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner email *"><input className="tb-input" type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} /></Field>
            <Field label="Owner name"><input className="tb-input" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
          </div>
          <Field label="Temporary password">
            <div className="flex gap-2">
              <input className="tb-input flex-1 font-mono" value={form.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} />
              <button
                type="button"
                onClick={() => set('ownerPassword', tempPassword())}
                title="Generate a new password"
                className="shrink-0 px-3 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                <FiRefreshCw size={15} />
              </button>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Share with the owner — they set their own on first login.</span>
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={create} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create'}
          </button>
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
