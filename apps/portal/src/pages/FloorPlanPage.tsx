import { useEffect, useState } from 'react';
import { FiSave, FiPlus, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FloorPlanBuilder, type BuilderState } from '../components/FloorPlanBuilder';
import type { FloorElement, TableModel } from '../types';

let zc = 0;
const zid = () => `zone_${Date.now().toString(36)}_${zc++}`;

// Every table the scheduler/Resources page knows about must have a draggable
// floor-plan element. Tables added outside the builder (e.g. via Settings →
// Resources) have none, so they'd render stuck & unmovable. Here we synthesize
// an element for each un-placed table, spread on a grid so they don't stack,
// and align the table's own position to it. This keeps tables unified across
// the scheduler, Resources page, and floor plan.
function withPlacedTables(tables: TableModel[], elements: FloorElement[]) {
  const placed = new Set(
    elements
      .filter((e) => e.type === 'table' && e.metadata?.tableId)
      .map((e) => e.metadata!.tableId as string),
  );
  const unplaced = tables.filter((t) => !placed.has(t.id));
  if (unplaced.length === 0) return { tables, elements };

  const COLS = 8;
  const newEls: FloorElement[] = [];
  const movedPos = new Map<string, { x: number; y: number }>();
  unplaced.forEach((t, i) => {
    const w = t.size?.width ?? 8;
    const h = t.size?.height ?? 8;
    const x = 5 + (i % COLS) * 11; // top-left, in 0..100 canvas coords
    const y = 6 + Math.floor(i / COLS) * 13;
    newEls.push({
      id: `el_${t.id}`,
      type: 'table',
      position: { x, y },
      size: { width: w, height: h },
      rotation: t.rotation ?? 0,
      metadata: { tableId: t.id, number: t.number },
    });
    movedPos.set(t.id, { x: x + w / 2, y: y + h / 2 });
  });
  return {
    tables: tables.map((t) =>
      movedPos.has(t.id) ? { ...t, position: movedPos.get(t.id)! } : t,
    ),
    elements: [...elements, ...newEls],
  };
}

export default function FloorPlanPage() {
  const { restaurant, refresh } = useAuth();
  const [state, setState] = useState<BuilderState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    const placed = withPlacedTables(restaurant.tables, restaurant.floorPlan.elements);
    setState({
      elements: placed.elements,
      tables: placed.tables,
      zones: restaurant.zones,
      background: restaurant.floorPlan.background,
    });
  }, [restaurant]);

  if (!restaurant || !state) return <div className="text-slate-400">Loading…</div>;

  const addZone = () => {
    const name = prompt('Zone name (e.g. Terrace, VIP, Bar Area)');
    if (!name) return;
    setState({ ...state, zones: [...state.zones, { id: zid(), name }] });
  };
  const removeZone = (id: string) =>
    setState({
      ...state,
      zones: state.zones.filter((z) => z.id !== id),
      tables: state.tables.map((t) => (t.zoneId === id ? { ...t, zoneId: null } : t)),
    });

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Persist zones first (tables reference zoneIds), then tables, then elements.
      await api.setZones(
        restaurant.id,
        state.zones.map((z) => ({ id: z.id, name: z.name })),
      );
      await api.setTables(restaurant.id, state.tables);
      await api.setFloorPlan(restaurant.id, state.elements, state.background);
      // Per-table minCapacity isn't a Table column — persist it into
      // reservationRules.resourceMeta (preserving any existing descriptions).
      const existingMeta = (restaurant.reservationRules?.resourceMeta || {}) as Record<
        string,
        { name?: string; description?: string; minCapacity?: number }
      >;
      const nextMeta: Record<string, { name?: string; description?: string; minCapacity?: number }> = {};
      for (const t of state.tables) {
        const entry = { ...(existingMeta[t.id] || {}) };
        if (t.minCapacity && t.minCapacity > 1) entry.minCapacity = Math.min(t.minCapacity, t.capacity);
        else delete entry.minCapacity;
        if (Object.keys(entry).length) nextMeta[t.id] = entry;
      }
      await api.updateRestaurant(restaurant.id, {
        reservationRules: { ...(restaurant.reservationRules || {}), resourceMeta: nextMeta },
      } as never);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Floor Plan</h2>
          <p className="text-slate-500 text-sm">
            Design the layout customers see when booking. Drag elements, place tables, set capacity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            <FiSave /> {saving ? 'Saving…' : 'Save floor plan'}
          </button>
        </div>
      </div>

      {/* Zones */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Zones</h4>
          <button onClick={addZone} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <FiPlus size={14} /> Add zone
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.zones.length === 0 && <p className="text-sm text-slate-400">No zones yet.</p>}
          {state.zones.map((z) => (
            <span key={z.id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full">
              {z.name}
              <button onClick={() => removeZone(z.id)} className="text-slate-400 hover:text-red-500">
                <FiX size={14} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <FloorPlanBuilder state={state} onChange={setState} />
    </div>
  );
}
