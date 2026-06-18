import { useState } from 'react';
import { FiX, FiDownloadCloud } from 'react-icons/fi';
import { api } from '../api/client';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRestaurantModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    cuisine: 'georgian',
    address: '',
    importUrl: '',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: 'password',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    setError('');
    if (!form.name || !form.ownerEmail) {
      setError('Name and owner email are required.');
      return;
    }
    setSaving(true);
    try {
      await api.createRestaurant(form);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Create Restaurant Account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Creates a restaurant in <strong>PENDING</strong> status plus a staff login. The owner
            completes setup on first login. Restaurants cannot self-register.
          </p>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              <FiDownloadCloud className="inline mr-1" />
              Google Maps URL (optional — prefills info on create)
            </label>
            <input className="tb-input" value={form.importUrl} onChange={(e) => set('importUrl', e.target.value)} placeholder="https://maps.google.com/…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Restaurant name *"><input className="tb-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Cuisine">
              <select className="tb-input" value={form.cuisine} onChange={(e) => set('cuisine', e.target.value)}>
                {['georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza', 'burgers', 'vegan'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Address"><input className="tb-input" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>

          <hr className="border-slate-100" />
          <p className="text-xs font-semibold text-slate-500 uppercase">Owner account</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner email *"><input className="tb-input" type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} /></Field>
            <Field label="Owner name"><input className="tb-input" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
          </div>
          <Field label="Temporary password"><input className="tb-input" value={form.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} /></Field>

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
