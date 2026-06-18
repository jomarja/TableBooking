import { useEffect, useRef, useState } from 'react';
import {
  FiSave,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiX,
  FiCheck,
  FiImage,
  FiUpload,
  FiLink,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { MenuItem, RestaurantImage } from '../types';

const CUISINES = [
  'georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza',
  'burgers', 'vegan', 'steakhouse', 'mexican', 'indian', 'mediterranean',
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRICE_LEVELS = [
  { label: '€ – Budget', value: 1 },
  { label: '€€ – Moderate', value: 2 },
  { label: '€€€ – Upscale', value: 3 },
  { label: '€€€€ – Fine Dining', value: 4 },
];
const IMAGE_TYPES = ['COVER', 'INTERIOR', 'TERRACE', 'FOOD', 'BAR'] as const;

type Tab = 'profile' | 'photos' | 'menu' | 'booking';

export default function SettingsPage() {
  const { restaurant, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile form
  const [form, setForm] = useState({
    name: '',
    cuisines: [] as string[],
    address: '',
    website: '',
    phone: '',
    description: '',
    priceLevel: 1,
    restDays: [] as string[],
    openingTime: '10:00',
    kitchenClosing: '22:00',
    closingTime: '23:00',
    allowTableSelection: true,
    autoConfirm: true,
    published: false,
    importUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  // Images
  const [images, setImages] = useState<RestaurantImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageType, setNewImageType] = useState<(typeof IMAGE_TYPES)[number]>('INTERIOR');
  const [addingImage, setAddingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Menu
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuEditing, setMenuEditing] = useState<MenuItem | null | undefined>(undefined);
  const [menuForm, setMenuForm] = useState({ category: 'Main', name: '', description: '', price: '', photo: '' });
  const [menuSaving, setMenuSaving] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name,
      cuisines: restaurant.cuisines?.length ? restaurant.cuisines : restaurant.cuisine ? [restaurant.cuisine] : [],
      address: restaurant.address,
      website: restaurant.website,
      phone: restaurant.phone,
      description: restaurant.description || '',
      priceLevel: restaurant.priceLevel || 1,
      restDays: restaurant.restDays || [],
      openingTime: restaurant.openingTime,
      kitchenClosing: restaurant.kitchenClosing,
      closingTime: restaurant.closingTime,
      allowTableSelection: restaurant.allowTableSelection,
      autoConfirm: restaurant.reservationConfirmationPolicy?.autoConfirm !== false,
      published: restaurant.published,
      importUrl: '',
    });
    setImages(restaurant.images || []);
    setMenu(restaurant.menu || []);
  }, [restaurant]);

  if (!restaurant) return <div className="text-slate-400">Loading…</div>;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleCuisine = (c: string) =>
    set('cuisines', form.cuisines.includes(c)
      ? form.cuisines.filter((x) => x !== c)
      : [...form.cuisines, c]);

  const toggleRestDay = (d: string) =>
    set('restDays', form.restDays.includes(d)
      ? form.restDays.filter((x) => x !== d)
      : [...form.restDays, d]);

  const saveProfile = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateRestaurant(restaurant.id, {
        name: form.name,
        cuisine: form.cuisines[0] || 'georgian',
        cuisines: form.cuisines,
        address: form.address,
        website: form.website,
        phone: form.phone,
        description: form.description,
        priceLevel: form.priceLevel,
        restDays: form.restDays,
        openingTime: form.openingTime,
        kitchenClosing: form.kitchenClosing,
        closingTime: form.closingTime,
        allowTableSelection: form.allowTableSelection,
        published: form.published,
        reservationConfirmationPolicy: form.autoConfirm
          ? { autoConfirm: true }
          : { autoConfirm: false, confirmationWindowMinutes: 15 },
      } as never);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncNote('');
    try {
      const updated = await api.syncGoogle(restaurant.id, form.importUrl || undefined);
      setForm((f) => ({
        ...f,
        website: (updated as any).website || f.website,
        phone: (updated as any).phone || f.phone,
      }));
      setSyncNote('Synced! Rating and operational info updated from Google.');
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  // Images
  const handleAddImage = async (urlOverride?: string) => {
    const url = urlOverride ?? newImageUrl.trim();
    if (!url) return;
    setAddingImage(true);
    try {
      const updated = await api.addImage(restaurant.id, url, newImageType);
      setImages((updated as any).images || []);
      setNewImageUrl('');
    } finally {
      setAddingImage(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddingImage(true);
    try {
      const url = await api.uploadImage(file);
      const updated = await api.addImage(restaurant.id, url, newImageType);
      setImages((updated as any).images || []);
    } finally {
      setAddingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const updated = await api.deleteImage(restaurant.id, imageId);
    setImages((updated as any).images || []);
  };

  // Menu
  const openMenuAdd = () => {
    setMenuEditing(null);
    setMenuForm({ category: 'Main', name: '', description: '', price: '', photo: '' });
  };
  const openMenuEdit = (item: MenuItem) => {
    setMenuEditing(item);
    setMenuForm({ category: item.category, name: item.name, description: item.description, price: item.price, photo: item.photo || '' });
  };
  const saveMenuItem = async () => {
    if (!menuForm.name.trim()) return;
    setMenuSaving(true);
    try {
      let updated: any;
      if (menuEditing) {
        updated = await api.updateMenuItem(restaurant.id, menuEditing.id, menuForm);
      } else {
        updated = await api.addMenuItem(restaurant.id, menuForm);
      }
      setMenu(updated.menu || []);
      setMenuEditing(undefined);
    } finally {
      setMenuSaving(false);
    }
  };
  const deleteMenuItem = async (itemId: string) => {
    const updated = await api.deleteMenuItem(restaurant.id, itemId);
    setMenu((updated as any).menu || []);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'photos', label: 'Photos' },
    { key: 'menu', label: 'Menu' },
    { key: 'booking', label: 'Booking & Visibility' },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Settings — Restaurant Profile</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Profile Tab ---- */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {/* Google sync */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-700">Sync with Google</p>
              {restaurant.googleSyncedAt && (
                <p className="text-xs text-slate-500">
                  Last synced: {new Date(restaurant.googleSyncedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="tb-input flex-1"
                placeholder="Google Maps URL (optional)"
                value={form.importUrl}
                onChange={(e) => set('importUrl', e.target.value)}
              />
              <button
                onClick={runSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap disabled:opacity-60"
              >
                <FiRefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync with Google'}
              </button>
            </div>
            {syncNote && <p className="text-xs text-emerald-600">{syncNote}</p>}
            <p className="text-xs text-slate-500">Syncs: rating, reviews, website, phone, opening hours, price info. Does not overwrite your description or photos.</p>
          </div>

          {/* Google rating (read-only) */}
          {(restaurant.rating > 0 || restaurant.reviewCount > 0) && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Google Rating</p>
                <p className="text-2xl font-bold text-amber-600">{restaurant.rating.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Reviews</p>
                <p className="text-2xl font-bold text-slate-800">{(restaurant.reviewCount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Last Synced</p>
                <p className="text-sm text-slate-600">
                  {restaurant.googleSyncedAt
                    ? new Date(restaurant.googleSyncedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Restaurant Name"><input className="tb-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Phone"><input className="tb-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
            <Field label="Address"><input className="tb-input" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Website"><input className="tb-input" value={form.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Price Level">
                <select className="tb-input" value={form.priceLevel} onChange={(e) => set('priceLevel', Number(e.target.value))}>
                  {PRICE_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea className="tb-input resize-none" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">Cuisine Type</label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <button key={c} type="button" onClick={() => toggleCuisine(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border capitalize transition-colors ${form.cuisines.includes(c) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">Rest Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button key={d} type="button" onClick={() => toggleRestDay(d)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.restDays.includes(d) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveProfile} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              <FiSave /> {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
          </div>
        </div>
      )}

      {/* ---- Photos Tab ---- */}
      {tab === 'photos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Add Photo</h3>

            {/* Category selector — applies to both upload and URL methods */}
            <Field label="Category">
              <select
                className="tb-input"
                value={newImageType}
                onChange={(e) => setNewImageType(e.target.value as typeof newImageType)}
              >
                {IMAGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </Field>

            {/* Upload from device */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Upload from device</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={addingImage}
                className="flex items-center gap-2 px-4 py-2.5 w-full border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-60"
              >
                <FiUpload size={16} />
                {addingImage ? 'Uploading…' : 'Click to choose a file or drag & drop'}
              </button>
            </div>

            {/* Or paste URL */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Or paste a URL</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FiLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="tb-input pl-8"
                    placeholder="https://example.com/photo.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                  />
                </div>
                <button
                  onClick={() => handleAddImage()}
                  disabled={addingImage || !newImageUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap"
                >
                  <FiPlus /> Add
                </button>
              </div>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="flex items-center justify-center h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
              <div className="text-center">
                <FiImage size={32} className="mx-auto mb-2 opacity-40" />
                No photos yet
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                  <img src={img.url} alt={img.type} className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => handleDeleteImage(img.id)}
                      className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600" title="Remove">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] font-medium px-2 py-1">{img.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Menu Tab ---- */}
      {tab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Menu Items</h3>
            <button onClick={openMenuAdd}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <FiPlus /> Add item
            </button>
          </div>

          {menuEditing !== undefined && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{menuEditing ? 'Edit item' : 'Add menu item'}</p>
                <button onClick={() => setMenuEditing(undefined)} className="text-slate-400 hover:text-slate-600"><FiX /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name *"><input className="tb-input" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} /></Field>
                <Field label="Category"><input className="tb-input" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} /></Field>
              </div>
              <Field label="Description"><input className="tb-input" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price"><input className="tb-input" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} /></Field>
                <Field label="Photo URL"><input className="tb-input" value={menuForm.photo} onChange={(e) => setMenuForm({ ...menuForm, photo: e.target.value })} /></Field>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMenuItem} disabled={menuSaving || !menuForm.name.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                  <FiCheck size={14} /> {menuSaving ? 'Saving…' : menuEditing ? 'Update' : 'Add item'}
                </button>
                <button onClick={() => setMenuEditing(undefined)} className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700">Cancel</button>
              </div>
            </div>
          )}

          {menu.length === 0 && menuEditing === undefined ? (
            <p className="text-center text-slate-400 text-sm py-10">No menu items yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {}),
              ).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{cat}</p>
                  <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {catItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                        {item.photo && <img src={item.photo} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{item.name}</p>
                          {item.description && <p className="text-xs text-slate-500 truncate">{item.description}</p>}
                        </div>
                        <span className="text-sm font-medium text-slate-700 flex-shrink-0">{item.price}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => openMenuEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><FiEdit2 size={14} /></button>
                          <button onClick={() => deleteMenuItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><FiTrash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Booking & Visibility Tab ---- */}
      {tab === 'booking' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Hours</h3>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Opening"><input type="time" className="tb-input" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} /></Field>
              <Field label="Kitchen closes"><input type="time" className="tb-input" value={form.kitchenClosing} onChange={(e) => set('kitchenClosing', e.target.value)} /></Field>
              <Field label="Closes"><input type="time" className="tb-input" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} /></Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">Booking Settings</h3>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.allowTableSelection} onChange={(e) => set('allowTableSelection', e.target.checked)} />
              Let customers pick their own table
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.autoConfirm} onChange={(e) => set('autoConfirm', e.target.checked)} />
              Auto-confirm reservations
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
              Published (visible to customers)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveProfile} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              <FiSave /> {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
          </div>
        </div>
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
