import { useMemo, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { FloorElement, ResourceMeta, TableModel } from '../types';
import { resourceLabel } from '../lib/resources';
import { NumberField } from './NumberField';
import { Select } from './Select';

const newId = () => 'res_' + Math.random().toString(36).slice(2, 10);

type ResForm = { id?: string; capacity: number; minCapacity: number; zoneId: string; description: string };

/** Settings → Resources: manage the tables guests can book. Tables are numbered
 *  automatically ("Table N") and kept in sync with the floor plan. An optional
 *  description lives in reservationRules.resourceMeta (no migration). */
export function ResourcesManager() {
  const { restaurant, refresh } = useAuth();
  const tables = useMemo(
    () => [...(restaurant?.tables || [])].sort((a, b) => a.number - b.number),
    [restaurant],
  );
  const zones = restaurant?.zones || [];
  const elements: FloorElement[] = restaurant?.floorPlan?.elements || [];
  const meta: Record<string, ResourceMeta> = restaurant?.reservationRules?.resourceMeta || {};
  const [editing, setEditing] = useState<ResForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [newZone, setNewZone] = useState('');
  const [savingZones, setSavingZones] = useState(false);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name || '—';

  // Zones are stored as Zone rows and shared with the floor plan + scheduler.
  const saveZones = async (next: { id?: string; name: string }[]) => {
    if (!restaurant) return;
    setSavingZones(true);
    try {
      await api.setZones(restaurant.id, next.map((z) => ({ id: z.id, name: z.name })));
      await refresh();
    } finally {
      setSavingZones(false);
    }
  };
  const addZone = () => {
    const n = newZone.trim();
    if (!n) return;
    void saveZones([...zones, { name: n }]);
    setNewZone('');
  };
  const removeZone = (z: { id: string; name: string }) => {
    if (!confirm(`Delete zone "${z.name}"? Tables in it will become unassigned.`)) return;
    void saveZones(zones.filter((x) => x.id !== z.id));
  };
  const renameZone = (z: { id: string; name: string }, name: string) => {
    const n = name.trim();
    if (n && n !== z.name) void saveZones(zones.map((x) => (x.id === z.id ? { ...x, name: n } : x)));
  };

  const persist = async (
    nextTables: TableModel[],
    nextMeta: Record<string, ResourceMeta>,
    nextElements?: FloorElement[],
  ) => {
    if (!restaurant) return;
    setSaving(true);
    try {
      await api.setTables(restaurant.id, nextTables);
      // Keep the floor plan in lockstep: adding/removing a resource also
      // adds/removes its floor-plan element, so the same table (and number)
      // shows up in both places and never drifts.
      if (nextElements) {
        await api.setFloorPlan(restaurant.id, nextElements, restaurant.floorPlan?.background ?? null);
      }
      await api.updateRestaurant(restaurant.id, {
        reservationRules: { ...(restaurant.reservationRules || {}), resourceMeta: nextMeta },
      } as never);
      await refresh();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const saveResource = async (form: ResForm) => {
    const id = form.id || newId();
    const existing = tables.find((t) => t.id === id);
    let nextTables: TableModel[];
    let nextElements: FloorElement[] | undefined;
    if (existing) {
      // Editing fields only — leave the floor-plan placement (and number) alone.
      nextTables = tables.map((t) =>
        t.id === id ? { ...t, capacity: form.capacity, zoneId: form.zoneId || null } : t,
      );
    } else {
      const number = tables.reduce((m, t) => Math.max(m, t.number), 0) + 1;
      // Drop the new table onto the same non-overlapping grid the floor plan
      // uses, and create its element now so it appears on the floor plan with
      // this exact number (the owner can drag it afterwards). Index by total
      // table count so it never lands on a legacy table the floor plan will
      // auto-place at a low grid slot.
      const gi = tables.length;
      const w = 8;
      const h = 8;
      const gx = 5 + (gi % 8) * 11;
      const gy = 6 + Math.floor(gi / 8) * 13;
      const created: TableModel = {
        id,
        number,
        capacity: form.capacity,
        shape: 'CIRCLE',
        zoneId: form.zoneId || null,
        tags: [],
        mergeGroup: null,
        position: { x: gx + w / 2, y: gy + h / 2 },
        size: { width: w, height: h },
        rotation: 0,
      };
      nextTables = [...tables, created];
      nextElements = [
        ...elements,
        {
          id: `el_${id}`,
          type: 'table',
          position: { x: gx, y: gy },
          size: { width: w, height: h },
          rotation: 0,
          metadata: { tableId: id, number },
        },
      ];
    }
    // Only persist a real minimum (>1); 1 or 0 means "no minimum — anyone can
    // book". Never let it exceed the table's max capacity. Spread the existing
    // entry so other resourceMeta keys survive, and drop the entry if empty.
    const mc = form.minCapacity > 1 ? Math.min(form.minCapacity, form.capacity) : undefined;
    const desc = form.description.trim();
    const entry: ResourceMeta = { ...(meta[id] || {}) };
    if (desc) entry.description = desc;
    else delete entry.description;
    if (mc) entry.minCapacity = mc;
    else delete entry.minCapacity;
    const nextMeta: Record<string, ResourceMeta> = { ...meta };
    if (Object.keys(entry).length) nextMeta[id] = entry;
    else delete nextMeta[id];
    await persist(nextTables, nextMeta, nextElements);
  };

  const remove = async (t: TableModel) => {
    if (!confirm(`Delete "${resourceLabel(restaurant, t)}"? Existing reservations on it will be unassigned.`)) return;
    const nextMeta = { ...meta };
    delete nextMeta[t.id];
    // Also drop its floor-plan element so no orphaned table lingers there.
    const nextElements = elements.filter((e) => e.metadata?.tableId !== t.id);
    await persist(tables.filter((x) => x.id !== t.id), nextMeta, nextElements);
  };

  const openAdd = () =>
    setEditing({ capacity: 2, minCapacity: 0, zoneId: zones[0]?.id || '', description: '' });
  const openEdit = (t: TableModel) =>
    setEditing({
      id: t.id,
      capacity: t.capacity,
      minCapacity: meta[t.id]?.minCapacity || 0,
      zoneId: t.zoneId || '',
      description: meta[t.id]?.description || '',
    });

  return (
    <div className="space-y-4">
      {/* Zones — shared with the floor plan & scheduler */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Zones</h3>
          {savingZones && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
        <p className="text-xs text-slate-500">
          Group tables by area (e.g. Terrace, Indoor). Zones are shared everywhere — the floor
          plan, the scheduler and table assignment.
        </p>
        <div className="space-y-2">
          {zones.length === 0 && <p className="text-xs text-slate-400">No zones yet.</p>}
          {zones.map((z) => (
            <div key={z.id} className="flex items-center gap-2">
              <input className="tb-input" defaultValue={z.name} onBlur={(e) => renameZone(z, e.target.value)} />
              <button
                onClick={() => removeZone(z)}
                disabled={zones.length <= 1}
                className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30"
                title={zones.length <= 1 ? 'Keep at least one zone' : 'Delete zone'}
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
            value={newZone}
            onChange={(e) => setNewZone(e.target.value)}
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Add the tables guests can book. They're numbered automatically and stay in sync with
          your floor plan, where you can arrange them.
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap"
        >
          <FiPlus /> Add table
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {tables.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No tables yet. Add your first one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Table</th>
                <th className="text-left px-3 py-3 font-semibold">Capacity</th>
                <th className="text-left px-3 py-3 font-semibold">Zone</th>
                <th className="text-left px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tables.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{resourceLabel(restaurant, t)}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {(meta[t.id]?.minCapacity ?? 0) > 1
                      ? `${meta[t.id]?.minCapacity}–${t.capacity}`
                      : t.capacity}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{zoneName(t.zoneId)}</td>
                  <td className="px-3 py-3 text-slate-500 truncate max-w-xs">{meta[t.id]?.description || '—'}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50" title="Edit">
                      <FiEdit2 size={14} />
                    </button>
                    <button onClick={() => remove(t)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete">
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ResourceForm
          form={editing}
          zones={zones}
          saving={saving}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => saveResource(editing)}
        />
      )}
    </div>
  );
}

function ResourceForm({
  form,
  zones,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  form: ResForm;
  zones: { id: string; name: string }[];
  saving: boolean;
  onChange: (f: ResForm) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof ResForm>(k: K, v: ResForm[K]) => onChange({ ...form, [k]: v });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{form.id ? 'Edit table' : 'Add table'}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Max capacity</span>
              <NumberField min={1} className="tb-input" value={form.capacity} onChange={(n) => set('capacity', n)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Min capacity (optional)</span>
              <NumberField min={0} className="tb-input" value={form.minCapacity} onChange={(n) => set('minCapacity', n)} />
              <span className="text-[11px] text-slate-400 mt-1 block">0 = anyone can book</span>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Zone (optional)</span>
            <Select
              className="w-full"
              ariaLabel="Zone (optional)"
              value={form.zoneId}
              onChange={(v) => set('zoneId', v)}
              options={[
                { value: '', label: '— None —' },
                ...zones.map((z) => ({ value: z.id, label: z.name })),
              ]}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Description (optional)</span>
            <input className="tb-input" placeholder="Notes about this resource" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add table'}
          </button>
        </div>
      </div>
    </div>
  );
}
