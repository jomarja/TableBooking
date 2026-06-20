import { useMemo, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ResourceMeta, TableModel } from '../types';
import { resourceLabel } from '../lib/resources';

const newId = () => 'res_' + Math.random().toString(36).slice(2, 10);

type ResForm = { id?: string; name: string; capacity: number; zoneId: string; description: string };

/** Settings → Resources: manage bookable resources (tables / rooms / spaces)
 *  without a floor plan. Resources are stored as Table rows; their display
 *  name + description live in reservationRules.resourceMeta (no migration). */
export function ResourcesManager() {
  const { restaurant, refresh } = useAuth();
  const tables = useMemo(
    () => [...(restaurant?.tables || [])].sort((a, b) => a.number - b.number),
    [restaurant],
  );
  const zones = restaurant?.zones || [];
  const meta: Record<string, ResourceMeta> = restaurant?.reservationRules?.resourceMeta || {};
  const [editing, setEditing] = useState<ResForm | null>(null);
  const [saving, setSaving] = useState(false);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name || '—';

  const persist = async (
    nextTables: TableModel[],
    nextMeta: Record<string, ResourceMeta>,
  ) => {
    if (!restaurant) return;
    setSaving(true);
    try {
      await api.setTables(restaurant.id, nextTables);
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
    if (existing) {
      nextTables = tables.map((t) =>
        t.id === id ? { ...t, capacity: form.capacity, zoneId: form.zoneId || null } : t,
      );
    } else {
      const number = tables.reduce((m, t) => Math.max(m, t.number), 0) + 1;
      const created: TableModel = {
        id,
        number,
        capacity: form.capacity,
        shape: 'CIRCLE',
        zoneId: form.zoneId || null,
        tags: [],
        mergeGroup: null,
        position: { x: 50, y: 50 },
        size: { width: 8, height: 8 },
        rotation: 0,
      };
      nextTables = [...tables, created];
    }
    const nextMeta: Record<string, ResourceMeta> = {
      ...meta,
      [id]: {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
      },
    };
    await persist(nextTables, nextMeta);
  };

  const remove = async (t: TableModel) => {
    if (!confirm(`Delete "${resourceLabel(restaurant, t)}"? Existing reservations on it will be unassigned.`)) return;
    const nextMeta = { ...meta };
    delete nextMeta[t.id];
    await persist(tables.filter((x) => x.id !== t.id), nextMeta);
  };

  const openAdd = () =>
    setEditing({ name: '', capacity: 2, zoneId: zones[0]?.id || '', description: '' });
  const openEdit = (t: TableModel) =>
    setEditing({
      id: t.id,
      name: meta[t.id]?.name || '',
      capacity: t.capacity,
      zoneId: t.zoneId || '',
      description: meta[t.id]?.description || '',
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Resources are anything guests book — tables, rooms, or spaces. Add them here when you
          don't use a floor plan.
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap"
        >
          <FiPlus /> Add Resource
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {tables.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No resources yet. Add your first one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Resource</th>
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
                  <td className="px-3 py-3 text-slate-600">{t.capacity}</td>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Resource' : 'Add Resource'}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Resource name *</span>
            <input
              className="tb-input"
              placeholder="e.g. VIP Table, Room 101, Conference Room A"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Capacity</span>
              <input type="number" min={1} className="tb-input" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Zone (optional)</span>
              <select className="tb-input" value={form.zoneId} onChange={(e) => set('zoneId', e.target.value)}>
                <option value="">— None —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Description (optional)</span>
            <input className="tb-input" placeholder="Notes about this resource" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add resource'}
          </button>
        </div>
      </div>
    </div>
  );
}
