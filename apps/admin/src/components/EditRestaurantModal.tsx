import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { api, type AdminRestaurant } from '../api/client';
import { NumberField } from './NumberField';
import { Select } from './Select';

const CUISINES = ['georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza', 'burgers', 'vegan', 'steakhouse', 'mexican', 'indian', 'mediterranean'];

interface Props {
  restaurant: AdminRestaurant;
  onClose: () => void;
  onSaved: () => void;
}

/** Admin edit of a restaurant's core profile — rating, info, visibility, etc. */
export function EditRestaurantModal({ restaurant, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    address: restaurant.address,
    website: restaurant.website,
    phone: restaurant.phone,
    rating: restaurant.rating,
    reviewCount: restaurant.reviewCount,
    priceRange: restaurant.priceRange,
    published: restaurant.published,
    outdoorSeating: restaurant.outdoorSeating,
    familyFriendly: restaurant.familyFriendly,
    description: restaurant.description,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.updateRestaurant(restaurant.id, { ...form, reviewCount: Math.round(form.reviewCount) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Edit restaurant</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Restaurant name *"><input className="tb-input" value={form.name} onChange={(e) => update('name', e.target.value)} /></Field>
            <Field label="Cuisine">
              <Select
                className="w-full"
                ariaLabel="Cuisine"
                value={form.cuisine}
                onChange={(v) => update('cuisine', v)}
                options={CUISINES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
          </div>

          <Field label="Address"><input className="tb-input" value={form.address} onChange={(e) => update('address', e.target.value)} /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Website"><input className="tb-input" value={form.website} onChange={(e) => update('website', e.target.value)} /></Field>
            <Field label="Phone"><input className="tb-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Rating (0–5)">
              <NumberField className="tb-input" min={0} max={5} step={0.1} value={form.rating} onChange={(n) => update('rating', n)} />
            </Field>
            <Field label="Review count">
              <NumberField className="tb-input" min={0} value={form.reviewCount} onChange={(n) => update('reviewCount', n)} />
            </Field>
            <Field label="Price range">
              <input className="tb-input" placeholder="e.g. ₾30-₾60" value={form.priceRange} onChange={(e) => update('priceRange', e.target.value)} />
            </Field>
          </div>

          <Field label="Description">
            <textarea className="tb-input resize-none" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.published} onChange={(e) => update('published', e.target.checked)} />
              Published (visible to customers)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.outdoorSeating} onChange={(e) => update('outdoorSeating', e.target.checked)} />
              Outdoor seating
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.familyFriendly} onChange={(e) => update('familyFriendly', e.target.checked)} />
              Family friendly
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Note: a restaurant only appears in the public list when its status is <strong>APPROVED</strong> and it is <strong>Published</strong>.
          </p>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
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
