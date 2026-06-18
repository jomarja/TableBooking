import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheck,
  FiArrowRight,
  FiArrowLeft,
  FiX,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiImage,
  FiUpload,
  FiLink,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FloorPlanBuilder, type BuilderState } from '../components/FloorPlanBuilder';
import type { MenuItem, RestaurantImage } from '../types';

const STEPS = [
  'Restaurant Info',
  'Photos',
  'Menu',
  'Operating Hours',
  'Floor Plan',
  'Configure Tables',
  'Review',
  'Publish',
];

const CUISINES = [
  'georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza',
  'burgers', 'vegan', 'steakhouse', 'mexican', 'indian', 'mediterranean',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PRICE_LEVELS: { label: string; value: number }[] = [
  { label: '€ – Budget', value: 1 },
  { label: '€€ – Moderate', value: 2 },
  { label: '€€€ – Upscale', value: 3 },
  { label: '€€€€ – Fine Dining', value: 4 },
];

const IMAGE_TYPES = ['COVER', 'INTERIOR', 'TERRACE', 'FOOD', 'BAR'] as const;

export default function SetupWizardPage() {
  const { restaurant, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Restaurant Info
  const [info, setInfo] = useState({
    name: '',
    cuisines: [] as string[],
    address: '',
    website: '',
    phone: '',
    description: '',
    priceLevel: 1,
    restDays: [] as string[],
  });

  // Step 1 — Photos
  const [images, setImages] = useState<RestaurantImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageType, setNewImageType] = useState<(typeof IMAGE_TYPES)[number]>('INTERIOR');
  const [addingImage, setAddingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Menu
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuEditing, setMenuEditing] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({ category: 'Main', name: '', description: '', price: '', photo: '' });
  const [menuSaving, setMenuSaving] = useState(false);

  // Step 3 — Operating Hours
  const [hours, setHours] = useState({
    openingTime: '10:00',
    kitchenClosing: '22:00',
    closingTime: '23:00',
    autoConfirm: true,
    allowTableSelection: true,
  });

  // Steps 4/5 — Floor Plan
  const [builder, setBuilder] = useState<BuilderState>({
    elements: [],
    tables: [],
    zones: [{ id: 'z_indoor', name: 'Indoor' }],
    background: null,
  });

  // Hydrate from existing restaurant on mount
  useEffect(() => {
    if (!restaurant) return;
    setInfo((p) => ({
      ...p,
      name: restaurant.name || '',
      cuisines: restaurant.cuisines?.length ? restaurant.cuisines : restaurant.cuisine ? [restaurant.cuisine] : [],
      address: restaurant.address || '',
      website: restaurant.website || '',
      phone: restaurant.phone || '',
      description: restaurant.description || '',
      priceLevel: restaurant.priceLevel || 1,
      restDays: restaurant.restDays || [],
    }));
    setHours((p) => ({
      ...p,
      openingTime: restaurant.openingTime,
      kitchenClosing: restaurant.kitchenClosing,
      closingTime: restaurant.closingTime,
      autoConfirm: restaurant.reservationConfirmationPolicy?.autoConfirm !== false,
      allowTableSelection: restaurant.allowTableSelection,
    }));
    setImages(restaurant.images || []);
    setMenu(restaurant.menu || []);
    if (restaurant.tables.length || restaurant.floorPlan.elements.length) {
      setBuilder({
        elements: restaurant.floorPlan.elements,
        tables: restaurant.tables,
        zones: restaurant.zones.length ? restaurant.zones : [{ id: 'z_indoor', name: 'Indoor' }],
        background: restaurant.floorPlan.background,
      });
    }
  }, [restaurant]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const persistProgress = async () => {
    if (!restaurant) return;
    await api.updateRestaurant(restaurant.id, {
      name: info.name,
      cuisine: info.cuisines[0] || 'georgian',
      cuisines: info.cuisines,
      address: info.address,
      website: info.website,
      phone: info.phone,
      description: info.description,
      priceLevel: info.priceLevel,
      restDays: info.restDays,
      openingTime: hours.openingTime,
      kitchenClosing: hours.kitchenClosing,
      closingTime: hours.closingTime,
      allowTableSelection: hours.allowTableSelection,
      reservationConfirmationPolicy: hours.autoConfirm
        ? { autoConfirm: true }
        : { autoConfirm: false, confirmationWindowMinutes: 15 },
    } as never);
    await api.setZones(restaurant.id, builder.zones.map((z) => ({ id: z.id, name: z.name })));
    await api.setTables(restaurant.id, builder.tables);
    await api.setFloorPlan(restaurant.id, builder.elements, builder.background);
  };

  const publish = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      await persistProgress();
      await api.updateRestaurant(restaurant.id, { published: true } as never);
      await refresh();
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const toggleCuisine = (c: string) => {
    setInfo((p) => ({
      ...p,
      cuisines: p.cuisines.includes(c)
        ? p.cuisines.filter((x) => x !== c)
        : [...p.cuisines, c],
    }));
  };

  const toggleRestDay = (d: string) => {
    setInfo((p) => ({
      ...p,
      restDays: p.restDays.includes(d)
        ? p.restDays.filter((x) => x !== d)
        : [...p.restDays, d],
    }));
  };

  // Image handlers
  const handleAddImage = async (urlOverride?: string) => {
    if (!restaurant) return;
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
    if (!restaurant) return;
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
    if (!restaurant) return;
    const updated = await api.deleteImage(restaurant.id, imageId);
    setImages((updated as any).images || []);
  };

  // Menu handlers
  const openMenuAdd = () => {
    setMenuEditing(null);
    setMenuForm({ category: 'Main', name: '', description: '', price: '', photo: '' });
  };

  const openMenuEdit = (item: MenuItem) => {
    setMenuEditing(item);
    setMenuForm({ category: item.category, name: item.name, description: item.description, price: item.price, photo: item.photo || '' });
  };

  const saveMenuItem = async () => {
    if (!restaurant || !menuForm.name.trim()) return;
    setMenuSaving(true);
    try {
      let updated: any;
      if (menuEditing) {
        updated = await api.updateMenuItem(restaurant.id, menuEditing.id, menuForm);
      } else {
        updated = await api.addMenuItem(restaurant.id, menuForm);
      }
      setMenu(updated.menu || []);
      setMenuEditing(null);
    } finally {
      setMenuSaving(false);
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!restaurant) return;
    const updated = await api.deleteMenuItem(restaurant.id, itemId);
    setMenu((updated as any).menu || []);
  };

  const canAdvance = () => {
    if (step === 0) return info.name.trim().length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-800">Welcome — let's set up your restaurant</h1>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-400 hover:text-slate-600">
            Log out
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto tb-scroll pb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                  i < step
                    ? 'bg-emerald-500 text-white'
                    : i === step
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-400 border border-slate-200'
                }`}
              >
                {i < step ? <FiCheck /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-slate-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[420px]">

          {/* ---- STEP 0: Restaurant Info ---- */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800">Restaurant Information</h2>

              {/* Core info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Restaurant Name *">
                  <input
                    className="tb-input"
                    placeholder="e.g. Shavi Lomi"
                    value={info.name}
                    onChange={(e) => setInfo({ ...info, name: e.target.value })}
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    className="tb-input"
                    placeholder="+995 555 000 000"
                    value={info.phone}
                    onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Address">
                <input
                  className="tb-input"
                  placeholder="Start typing an address…"
                  value={info.address}
                  onChange={(e) => setInfo({ ...info, address: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Website">
                  <input
                    className="tb-input"
                    placeholder="www.example.ge"
                    value={info.website}
                    onChange={(e) => setInfo({ ...info, website: e.target.value })}
                  />
                </Field>
                <Field label="Average Price Per Person">
                  <select className="tb-input" value={info.priceLevel} onChange={(e) => setInfo({ ...info, priceLevel: Number(e.target.value) })}>
                    {PRICE_LEVELS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  className="tb-input resize-none"
                  rows={3}
                  placeholder="Describe your restaurant — atmosphere, specialties, what makes it unique…"
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                />
              </Field>

              {/* Cuisine type (multi) */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Cuisine Type (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCuisine(c)}
                      className={`px-3 py-1.5 rounded-full text-sm border capitalize transition-colors ${
                        info.cuisines.includes(c)
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rest days */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Rest Days (days the restaurant is closed)</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleRestDay(d)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        info.restDays.includes(d)
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-red-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ---- STEP 1: Photos ---- */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Restaurant Photos</h2>
              <p className="text-sm text-slate-500">Add a banner/cover image and gallery photos. Customers will see these on your restaurant page.</p>

              {/* Add image form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-medium text-slate-700">Add a photo</p>

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
                    {addingImage ? 'Uploading…' : 'Click to choose a file'}
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

              {/* Gallery */}
              {images.length === 0 ? (
                <div className="flex items-center justify-center h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                  <div className="text-center">
                    <FiImage size={32} className="mx-auto mb-2 opacity-40" />
                    No photos yet — add your first one above
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                      <img src={img.url} alt={img.type} className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          title="Remove"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] font-medium px-2 py-1">
                        {img.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- STEP 2: Menu ---- */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">Menu</h2>
                <button
                  onClick={openMenuAdd}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <FiPlus /> Add item
                </button>
              </div>

              {/* Inline add/edit form */}
              {(menuEditing !== undefined) && (
                <MenuItemForm
                  form={menuForm}
                  editing={menuEditing}
                  saving={menuSaving}
                  onChange={setMenuForm}
                  onSave={saveMenuItem}
                  onCancel={() => setMenuEditing(undefined as any)}
                />
              )}

              {menu.length === 0 && menuEditing === undefined ? (
                <p className="text-center text-slate-400 text-sm py-10">No menu items yet. Add your first item above.</p>
              ) : (
                <MenuList
                  items={menu}
                  onEdit={openMenuEdit}
                  onDelete={deleteMenuItem}
                />
              )}
            </div>
          )}

          {/* ---- STEP 3: Operating Hours ---- */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Operating Hours</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Opening time">
                  <input type="time" className="tb-input" value={hours.openingTime} onChange={(e) => setHours({ ...hours, openingTime: e.target.value })} />
                </Field>
                <Field label="Kitchen closes">
                  <input type="time" className="tb-input" value={hours.kitchenClosing} onChange={(e) => setHours({ ...hours, kitchenClosing: e.target.value })} />
                </Field>
                <Field label="Restaurant closes">
                  <input type="time" className="tb-input" value={hours.closingTime} onChange={(e) => setHours({ ...hours, closingTime: e.target.value })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={hours.allowTableSelection} onChange={(e) => setHours({ ...hours, allowTableSelection: e.target.checked })} />
                Let customers pick their own table
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={hours.autoConfirm} onChange={(e) => setHours({ ...hours, autoConfirm: e.target.checked })} />
                Auto-confirm reservations (otherwise staff confirm within 15 minutes)
              </label>
            </div>
          )}

          {/* ---- STEPS 4/5: Floor Plan + Tables ---- */}
          {(step === 4 || step === 5) && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">
                {step === 4 ? 'Design Your Floor Plan' : 'Configure Tables'}
              </h2>
              <p className="text-sm text-slate-500">
                {step === 4
                  ? 'Add walls, kitchen, bar, and tables. Optionally upload a floor-plan image to trace over.'
                  : 'Select each table to set its number, capacity, shape, zone, and tags.'}
              </p>
              <FloorPlanBuilder state={builder} onChange={setBuilder} />
            </div>
          )}

          {/* ---- STEP 6: Review ---- */}
          {step === 6 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">Review</h2>
              <ReviewRow label="Name" value={info.name || '—'} />
              <ReviewRow label="Cuisine" value={info.cuisines.join(', ') || '—'} />
              <ReviewRow label="Address" value={info.address || '—'} />
              <ReviewRow label="Phone" value={info.phone || '—'} />
              <ReviewRow label="Description" value={info.description ? info.description.slice(0, 60) + (info.description.length > 60 ? '…' : '') : '—'} />
              <ReviewRow label="Price level" value={PRICE_LEVELS.find((p) => p.value === info.priceLevel)?.label || '—'} />
              <ReviewRow label="Rest days" value={info.restDays.join(', ') || 'None'} />
              <ReviewRow label="Photos" value={`${images.length} photo${images.length !== 1 ? 's' : ''}`} />
              <ReviewRow label="Menu items" value={`${menu.length} item${menu.length !== 1 ? 's' : ''}`} />
              <ReviewRow label="Hours" value={`${hours.openingTime} · kitchen ${hours.kitchenClosing} · closes ${hours.closingTime}`} />
              <ReviewRow label="Zones" value={builder.zones.map((z) => z.name).join(', ') || '—'} />
              <ReviewRow label="Tables" value={`${builder.tables.length} configured`} />
              <ReviewRow label="Table selection" value={hours.allowTableSelection ? 'Customers choose table' : 'Reserve only'} />
            </div>
          )}

          {/* ---- STEP 7: Publish ---- */}
          {step === 7 && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <FiCheck size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Ready to publish</h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Publishing makes <strong>{info.name}</strong> visible to customers and bookable immediately.
              </p>
              <button
                onClick={publish}
                disabled={saving}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? 'Publishing…' : 'Publish restaurant'}
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < STEPS.length - 1 && (
          <div className="flex justify-between mt-4">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium disabled:opacity-40 hover:bg-white"
            >
              <FiArrowLeft /> Back
            </button>
            <button
              onClick={async () => {
                if (step >= 1) await persistProgress().catch(() => {});
                next();
              }}
              disabled={!canAdvance()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              Continue <FiArrowRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right max-w-xs truncate">{value}</span>
    </div>
  );
}

function MenuItemForm({
  form,
  editing,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  form: { category: string; name: string; description: string; price: string; photo: string };
  editing: MenuItem | null;
  saving: boolean;
  onChange: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: string, v: string) => onChange({ ...form, [k]: v });
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{editing ? 'Edit item' : 'Add menu item'}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><FiX /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *">
          <input className="tb-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Khinkali" />
        </Field>
        <Field label="Category">
          <input className="tb-input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Starters" />
        </Field>
      </div>
      <Field label="Description">
        <input className="tb-input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price">
          <input className="tb-input" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="e.g. 12 ₾" />
        </Field>
        <Field label="Photo URL (optional)">
          <input className="tb-input" value={form.photo} onChange={(e) => set('photo', e.target.value)} placeholder="https://…" />
        </Field>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          <FiCheck size={14} /> {saving ? 'Saving…' : editing ? 'Update' : 'Add item'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}

function MenuList({
  items,
  onEdit,
  onDelete,
}: {
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
}) {
  const byCategory = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([cat, catItems]) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{cat}</p>
          <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {catItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                {item.photo && (
                  <img src={item.photo} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  {item.description && <p className="text-xs text-slate-500 truncate">{item.description}</p>}
                </div>
                <span className="text-sm font-medium text-slate-700 flex-shrink-0">{item.price}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
                    <FiEdit2 size={14} />
                  </button>
                  <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
