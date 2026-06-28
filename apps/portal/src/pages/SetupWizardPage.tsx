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
import type { MenuItem, RestaurantImage, TableModel } from '../types';
import { parsePriceRange, formatPriceRange, priceLevelFromRange } from '../lib/price';
import { NumberField } from '../components/NumberField';
import { Select } from '../components/Select';
import ImpersonationBanner from '../components/ImpersonationBanner';
import ConfirmDialog from '../components/ConfirmDialog';

const STEPS = [
  'Restaurant Info',
  'Photos',
  'Menu',
  'Operating Hours',
  'Configure Tables',
  'Floor Plan',
  'Review',
  'Publish',
];

// Keep in sync with Settings + the customer filter chips
// (apps/customer/src/data/restaurants.js).
const CUISINES = [
  'georgian', 'asian', 'italian', 'seafood', 'sushi', 'pizza',
  'burgers', 'vegan', 'steakhouse', 'mexican', 'indian', 'mediterranean',
  'desserts', 'shawarma', 'fastfood',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const IMAGE_TYPES = ['COVER', 'INTERIOR', 'TERRACE', 'FOOD', 'BAR'] as const;

// Give every table that isn't yet linked to a floor-plan element a position on a
// non-overlapping grid (and create that element) so tables added in the
// "Configure Tables" step appear — and become draggable — on the floor plan.
function placeTablesOnGrid(state: BuilderState): BuilderState {
  const linked = new Set(
    state.elements
      .filter((e) => e.type === 'table' && e.metadata?.tableId)
      .map((e) => e.metadata!.tableId as string),
  );
  const unplaced = state.tables.filter((t) => !linked.has(t.id));
  if (unplaced.length === 0) return state;
  const elements = [...state.elements];
  let tables = state.tables;
  let n = state.elements.filter((e) => e.type === 'table').length;
  for (const t of unplaced) {
    const size = { width: t.size?.width || 8, height: t.size?.height || 8 };
    const pos = { x: 6 + ((n % 8) * 11), y: 6 + ((Math.floor(n / 8) % 5) * 12) };
    elements.push({
      id: `el_${Date.now().toString(36)}_${n}`,
      type: 'table',
      position: pos,
      size,
      rotation: 0,
      metadata: { tableId: t.id, number: t.number },
    });
    tables = tables.map((x) =>
      x.id === t.id
        ? { ...x, position: { x: pos.x + size.width / 2, y: pos.y + size.height / 2 } }
        : x,
    );
    n++;
  }
  return { ...state, elements, tables };
}

export default function SetupWizardPage() {
  const { restaurant, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Unique id for the default zone — must be globally unique (zone id is a PK),
  // so we can't hard-code one shared across restaurants.
  const [defaultZoneId] = useState(() => `z_${Math.random().toString(36).slice(2, 10)}`);

  // Step 0 — Restaurant Info
  const [info, setInfo] = useState({
    name: '',
    cuisines: [] as string[],
    address: '',
    website: '',
    phone: '',
    description: '',
    priceMin: 30,
    priceMax: 60,
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
    zones: [{ id: defaultZoneId, name: 'Indoor' }],
    background: null,
  });

  // Hydrate from existing restaurant on mount
  useEffect(() => {
    if (!restaurant) return;
    const pr = parsePriceRange(restaurant.priceRange);
    setInfo((p) => ({
      ...p,
      name: restaurant.name || '',
      cuisines: restaurant.cuisines?.length ? restaurant.cuisines : restaurant.cuisine ? [restaurant.cuisine] : [],
      address: restaurant.address || '',
      website: restaurant.website || '',
      phone: restaurant.phone || '',
      description: restaurant.description || '',
      priceMin: pr.min,
      priceMax: pr.max,
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
        zones: restaurant.zones.length ? restaurant.zones : [{ id: defaultZoneId, name: 'Indoor' }],
        background: restaurant.floorPlan.background,
      });
    }
  }, [restaurant]);

  // Entering the Floor Plan step: drop any not-yet-placed tables onto a
  // non-overlapping grid so they show up (and can be dragged) on the canvas.
  useEffect(() => {
    if (step !== 5) return;
    setBuilder((b) => placeTablesOnGrid(b));
  }, [step]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const persistProgress = async () => {
    if (!restaurant) return;
    // Per-table minCapacity lives in reservationRules.resourceMeta (no column).
    const existingMeta = (restaurant.reservationRules?.resourceMeta || {}) as Record<
      string,
      { name?: string; description?: string; minCapacity?: number }
    >;
    const resourceMeta: Record<string, { name?: string; description?: string; minCapacity?: number }> = {};
    for (const t of builder.tables) {
      const entry = { ...(existingMeta[t.id] || {}) };
      if (t.minCapacity && t.minCapacity > 1) entry.minCapacity = Math.min(t.minCapacity, t.capacity);
      else delete entry.minCapacity;
      if (Object.keys(entry).length) resourceMeta[t.id] = entry;
    }
    await api.updateRestaurant(restaurant.id, {
      name: info.name,
      cuisine: info.cuisines[0] || 'georgian',
      cuisines: info.cuisines,
      address: info.address,
      website: info.website,
      phone: info.phone,
      description: info.description,
      priceRange: formatPriceRange(info.priceMin, info.priceMax),
      priceLevel: priceLevelFromRange(info.priceMax),
      restDays: info.restDays,
      openingTime: hours.openingTime,
      kitchenClosing: hours.kitchenClosing,
      closingTime: hours.closingTime,
      allowTableSelection: hours.allowTableSelection,
      reservationConfirmationPolicy: hours.autoConfirm
        ? { autoConfirm: true }
        : { autoConfirm: false, confirmationWindowMinutes: 15 },
      reservationRules: { ...(restaurant.reservationRules || {}), resourceMeta },
    } as never);
    await api.setZones(restaurant.id, builder.zones.map((z) => ({ id: z.id, name: z.name })));
    await api.setTables(restaurant.id, builder.tables);
    await api.setFloorPlan(restaurant.id, builder.elements, builder.background);
  };

  const publish = async () => {
    if (!restaurant) return;
    setSaving(true);
    setError('');
    try {
      await persistProgress();
      await api.updateRestaurant(restaurant.id, { published: true } as never);
      await refresh();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish. Please try again.');
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
      <ImpersonationBanner />
      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        tone="danger"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
          navigate('/login');
        }}
        onCancel={() => setConfirmLogout(false)}
      />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-800">Welcome — let's set up your restaurant</h1>
          <button onClick={() => setConfirmLogout(true)} className="text-sm text-slate-400 hover:text-slate-600">
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
                <Field label="Average Price Per Person (₾)">
                  <div className="flex items-center gap-2">
                    <NumberField
                      min={0}
                      className="tb-input flex-1"
                      placeholder="From"
                      value={info.priceMin}
                      onChange={(n) => setInfo({ ...info, priceMin: n })}
                    />
                    <span className="text-slate-400">–</span>
                    <NumberField
                      min={0}
                      className="tb-input flex-1"
                      placeholder="To"
                      value={info.priceMax}
                      onChange={(n) => setInfo({ ...info, priceMax: n })}
                    />
                  </div>
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
                  <Select
                    className="w-full"
                    ariaLabel="Category"
                    value={newImageType}
                    onChange={(v) => setNewImageType(v as typeof newImageType)}
                    options={IMAGE_TYPES.map((t) => ({
                      value: t,
                      label: t.charAt(0) + t.slice(1).toLowerCase(),
                    }))}
                  />
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

          {/* ---- STEP 4: Configure Tables (list) ---- */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Configure Tables</h2>
                <p className="text-sm text-slate-500">
                  Add your zones and the tables guests can book. You'll arrange them visually on the floor plan in the next step.
                </p>
              </div>
              <WizardTables state={builder} onChange={setBuilder} />
            </div>
          )}

          {/* ---- STEP 5: Floor Plan (arrange) ---- */}
          {step === 5 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">Design Your Floor Plan</h2>
              <p className="text-sm text-slate-500">
                Your tables are laid out below — drag each one where you like. Add walls, kitchen, bar, and other decor from the palette.
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
              <ReviewRow label="Price range" value={`₾${info.priceMin} – ₾${info.priceMax}`} />
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
              {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
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

function WizardTables({
  state,
  onChange,
}: {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
}) {
  const [zoneName, setZoneName] = useState('');
  const [form, setForm] = useState<
    null | { id?: string; capacity: number; minCapacity: number; zoneId: string; shape: TableModel['shape'] }
  >(null);

  const zones = state.zones;
  const tables = [...state.tables].sort((a, b) => a.number - b.number);
  const zoneLabel = (id: string | null) => zones.find((z) => z.id === id)?.name || '—';
  const nextNumber = () => state.tables.reduce((m, t) => Math.max(m, t.number), 0) + 1;

  const addZone = () => {
    const name = zoneName.trim();
    if (!name) return;
    onChange({
      ...state,
      zones: [...zones, { id: `z_${Math.random().toString(36).slice(2, 10)}`, name }],
    });
    setZoneName('');
  };
  const renameZone = (id: string, name: string) =>
    onChange({ ...state, zones: zones.map((z) => (z.id === id ? { ...z, name } : z)) });
  const removeZone = (id: string) =>
    onChange({
      ...state,
      zones: zones.filter((z) => z.id !== id),
      tables: state.tables.map((t) => (t.zoneId === id ? { ...t, zoneId: null } : t)),
    });

  const openAdd = () => setForm({ capacity: 2, minCapacity: 0, zoneId: zones[0]?.id || '', shape: 'CIRCLE' });
  const openEdit = (t: TableModel) =>
    setForm({ id: t.id, capacity: t.capacity, minCapacity: t.minCapacity || 0, zoneId: t.zoneId || '', shape: t.shape });

  const saveTable = () => {
    if (!form) return;
    const minCap = form.minCapacity > 1 ? Math.min(form.minCapacity, form.capacity) : null;
    if (form.id) {
      onChange({
        ...state,
        tables: state.tables.map((t) =>
          t.id === form.id
            ? { ...t, capacity: form.capacity, minCapacity: minCap, zoneId: form.zoneId || null, shape: form.shape }
            : t,
        ),
      });
    } else {
      const table: TableModel = {
        id: `tbl_${Math.random().toString(36).slice(2, 10)}`,
        number: nextNumber(),
        capacity: form.capacity,
        minCapacity: minCap,
        shape: form.shape,
        zoneId: form.zoneId || null,
        tags: [],
        mergeGroup: null,
        position: { x: 50, y: 50 },
        size: { width: 8, height: 8 },
        rotation: 0,
      };
      onChange({ ...state, tables: [...state.tables, table] });
    }
    setForm(null);
  };

  const removeTable = (t: TableModel) =>
    onChange({
      ...state,
      tables: state.tables.filter((x) => x.id !== t.id),
      elements: state.elements.filter((e) => e.metadata?.tableId !== t.id),
    });

  return (
    <div className="space-y-5">
      {/* Zones */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Zones</h3>
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="flex items-center gap-2">
              <input className="tb-input" value={z.name} onChange={(e) => renameZone(z.id, e.target.value)} />
              <button
                onClick={() => removeZone(z.id)}
                disabled={zones.length <= 1}
                className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30"
                title={zones.length <= 1 ? 'Keep at least one zone' : 'Remove zone'}
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="tb-input"
            placeholder="New zone (e.g. Terrace, VIP Room)"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addZone()}
          />
          <button
            onClick={addZone}
            className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 whitespace-nowrap"
          >
            <FiPlus /> Add zone
          </button>
        </div>
      </div>

      {/* Tables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Tables</h3>
          <button
            onClick={openAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <FiPlus /> Add table
          </button>
        </div>

        {form && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{form.id ? 'Edit table' : 'Add table'}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Max capacity">
                <NumberField
                  min={1}
                  className="tb-input"
                  value={form.capacity}
                  onChange={(n) => setForm({ ...form, capacity: n })}
                />
              </Field>
              <Field label="Min capacity (optional)">
                <NumberField
                  min={0}
                  className="tb-input"
                  value={form.minCapacity}
                  onChange={(n) => setForm({ ...form, minCapacity: n })}
                />
              </Field>
              <Field label="Zone">
                <Select
                  className="w-full"
                  ariaLabel="Zone"
                  value={form.zoneId}
                  onChange={(v) => setForm({ ...form, zoneId: v })}
                  options={[
                    { value: '', label: '— None —' },
                    ...zones.map((z) => ({ value: z.id, label: z.name })),
                  ]}
                />
              </Field>
              <Field label="Shape">
                <Select
                  className="w-full"
                  ariaLabel="Shape"
                  value={form.shape}
                  onChange={(v) => setForm({ ...form, shape: v as TableModel['shape'] })}
                  options={[
                    { value: 'CIRCLE', label: 'Circle' },
                    { value: 'SQUARE', label: 'Square' },
                    { value: 'RECT', label: 'Rectangle' },
                  ]}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveTable}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <FiCheck size={14} /> {form.id ? 'Update' : 'Add table'}
              </button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {tables.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No tables yet. Add your first table above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Table</th>
                  <th className="text-left px-3 py-3 font-semibold">Capacity</th>
                  <th className="text-left px-3 py-3 font-semibold">Zone</th>
                  <th className="text-left px-3 py-3 font-semibold">Shape</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">Table {t.number}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {t.minCapacity && t.minCapacity > 1 ? `${t.minCapacity}–${t.capacity}` : t.capacity}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{zoneLabel(t.zoneId)}</td>
                    <td className="px-3 py-3 text-slate-600 capitalize">{t.shape.toLowerCase()}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50" title="Edit">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => removeTable(t)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete">
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
      <Field label="Price">
        <input className="tb-input" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="e.g. 12 ₾" />
      </Field>
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
