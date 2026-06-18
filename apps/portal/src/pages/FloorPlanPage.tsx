import { useEffect, useState } from 'react';
import { FiSave, FiPlus, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FloorPlanBuilder, type BuilderState } from '../components/FloorPlanBuilder';

let zc = 0;
const zid = () => `zone_${Date.now().toString(36)}_${zc++}`;

export default function FloorPlanPage() {
  const { restaurant, refresh } = useAuth();
  const [state, setState] = useState<BuilderState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setState({
      elements: restaurant.floorPlan.elements,
      tables: restaurant.tables,
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
