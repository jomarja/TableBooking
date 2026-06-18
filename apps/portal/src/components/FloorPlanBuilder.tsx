import { useRef, useState, useCallback } from 'react';
import { FiTrash2, FiRotateCw } from 'react-icons/fi';
// The builder renders through the SAME shared canvas the customer app uses.
import { FloorPlanCanvas, PALETTE, toRelX, toRelY } from '@shared/floorplan/index.js';
import type { FloorElement, TableModel, Zone } from '../types';

let idc = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${idc++}`;

export interface BuilderState {
  elements: FloorElement[];
  tables: TableModel[];
  zones: Zone[];
  background: string | null;
}

interface Props {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
}

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  table: { w: 8, h: 8 },
  window: { w: 2, h: 10 },
  door: { w: 6, h: 3 },
  wc: { w: 12, h: 9 },
  kitchen: { w: 24, h: 14 },
  ac: { w: 6, h: 3 },
  bar: { w: 24, h: 12 },
  wall: { w: 20, h: 2 },
  plant: { w: 5, h: 5 },
  terrace: { w: 36, h: 24 },
  entrance: { w: 12, h: 4 },
};

export function FloorPlanBuilder({ state, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);

  const selectedEl = state.elements.find((e) => e.id === selectedId) || null;
  const selectedTable = selectedEl?.metadata?.tableId
    ? state.tables.find((t) => t.id === selectedEl.metadata.tableId) || null
    : null;

  const nextTableNumber = () =>
    state.tables.reduce((max, t) => Math.max(max, t.number), 0) + 1;

  // Convert a pointer event to relative (0..100) coords on the canvas.
  const eventToRel = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * 1000;
    const py = ((clientY - rect.top) / rect.height) * 600;
    return { x: toRelX(px), y: toRelY(py) };
  }, []);

  const addElement = (type: string) => {
    const size = DEFAULT_SIZES[type] || { w: 10, h: 10 };
    const el: FloorElement = {
      id: uid('el'),
      type,
      position: { x: 46, y: 46 },
      size: { width: size.w, height: size.h },
      rotation: 0,
      metadata: {},
    };
    let tables = state.tables;
    if (type === 'table') {
      const number = nextTableNumber();
      const table: TableModel = {
        id: uid('tbl'),
        number,
        capacity: 2,
        shape: 'CIRCLE',
        zoneId: state.zones[0]?.id || null,
        tags: [],
        mergeGroup: null,
        position: { x: 50, y: 50 },
        size: { width: size.w, height: size.h },
        rotation: 0,
      };
      el.metadata = { tableId: table.id, number };
      tables = [...state.tables, table];
    }
    onChange({ ...state, elements: [...state.elements, el], tables });
    setSelectedId(el.id);
  };

  const updateElement = (id: string, patch: Partial<FloorElement>) => {
    onChange({
      ...state,
      elements: state.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const updateSelectedTable = (patch: Partial<TableModel>) => {
    if (!selectedTable) return;
    onChange({
      ...state,
      tables: state.tables.map((t) => (t.id === selectedTable.id ? { ...t, ...patch } : t)),
    });
  };

  const deleteSelected = () => {
    if (!selectedEl) return;
    const tableId = selectedEl.metadata?.tableId as string | undefined;
    onChange({
      ...state,
      elements: state.elements.filter((e) => e.id !== selectedEl.id),
      tables: tableId ? state.tables.filter((t) => t.id !== tableId) : state.tables,
    });
    setSelectedId(null);
  };

  const onElementPointerDown = (e: React.PointerEvent, el: FloorElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const rel = eventToRel(e.clientX, e.clientY);
    dragRef.current = {
      id: el.id,
      offX: rel.x - el.position.x,
      offY: rel.y - el.position.y,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rel = eventToRel(e.clientX, e.clientY);
      const x = Math.max(0, Math.min(98, rel.x - drag.offX));
      const y = Math.max(0, Math.min(98, rel.y - drag.offY));
      onChange((() => {
        const elements = stateRef.current.elements.map((el) =>
          el.id === drag.id ? { ...el, position: { x, y } } : el,
        );
        // keep linked table position in sync (center = element top-left + half size)
        const movedEl = elements.find((el) => el.id === drag.id);
        let tables = stateRef.current.tables;
        if (movedEl?.metadata?.tableId) {
          tables = tables.map((t) =>
            t.id === movedEl.metadata.tableId
              ? {
                  ...t,
                  position: {
                    x: movedEl.position.x + movedEl.size.width / 2,
                    y: movedEl.position.y + movedEl.size.height / 2,
                  },
                }
              : t,
          );
        }
        return { ...stateRef.current, elements, tables };
      })());
    },
    [eventToRel, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  // Keep a ref of latest state for the move handler (closures).
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleBackgroundUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange({ ...state, background: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_240px] gap-4">
      {/* Palette */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Elements</h4>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              onClick={() => addElement(p.type)}
              className="flex items-center gap-2 px-2 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-indigo-50 hover:border-indigo-300"
            >
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-indigo-600 cursor-pointer hover:underline">
          Upload background (image)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleBackgroundUpload(e.target.files[0])}
          />
        </label>
        {state.background && (
          <button
            onClick={() => onChange({ ...state, background: null })}
            className="mt-1 text-xs text-red-500 hover:underline"
          >
            Remove background
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
          <div className="absolute inset-0">
            <FloorPlanCanvas
              elements={state.elements}
              tables={state.tables}
              background={state.background}
              editable
              svgRef={svgRef}
              selectedElementId={selectedId}
              onElementPointerDown={onElementPointerDown}
              onCanvasPointerDown={() => setSelectedId(null)}
              getTableStatus={() => 'available'}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Click an element to select it. Drag to move. Use the panel to set properties.
        </p>
      </div>

      {/* Properties */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Properties</h4>
        {!selectedEl && <p className="text-sm text-slate-400">Select an element to edit it.</p>}
        {selectedEl && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 capitalize">{selectedEl.type}</p>

            {selectedTable && (
              <>
                <PropField label="Table number">
                  <input
                    type="number"
                    className="tb-input"
                    value={selectedTable.number}
                    onChange={(e) => updateSelectedTable({ number: Number(e.target.value) })}
                  />
                </PropField>
                <PropField label="Capacity">
                  <input
                    type="number"
                    min={1}
                    className="tb-input"
                    value={selectedTable.capacity}
                    onChange={(e) => updateSelectedTable({ capacity: Number(e.target.value) })}
                  />
                </PropField>
                <PropField label="Shape">
                  <select
                    className="tb-input"
                    value={selectedTable.shape}
                    onChange={(e) =>
                      updateSelectedTable({ shape: e.target.value as TableModel['shape'] })
                    }
                  >
                    <option value="CIRCLE">Circle</option>
                    <option value="SQUARE">Square</option>
                    <option value="RECT">Rectangle</option>
                  </select>
                </PropField>
                <PropField label="Zone">
                  <select
                    className="tb-input"
                    value={selectedTable.zoneId || ''}
                    onChange={(e) => updateSelectedTable({ zoneId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {state.zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </PropField>
                <PropField label="Merge group (optional)">
                  <input
                    className="tb-input"
                    placeholder="e.g. A"
                    value={selectedTable.mergeGroup || ''}
                    onChange={(e) => updateSelectedTable({ mergeGroup: e.target.value || null })}
                  />
                </PropField>
                <PropField label="Tags">
                  <div className="flex flex-wrap gap-1">
                    {['near_window', 'quiet', 'near_terrace', 'near_bar', 'private'].map((tag) => {
                      const on = selectedTable.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() =>
                            updateSelectedTable({
                              tags: on
                                ? selectedTable.tags.filter((t) => t !== tag)
                                : [...selectedTable.tags, tag],
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            on
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          {tag.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </PropField>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <PropField label="Width">
                <input
                  type="number"
                  className="tb-input"
                  value={Math.round(selectedEl.size.width)}
                  onChange={(e) =>
                    updateElement(selectedEl.id, {
                      size: { ...selectedEl.size, width: Number(e.target.value) },
                    })
                  }
                />
              </PropField>
              <PropField label="Height">
                <input
                  type="number"
                  className="tb-input"
                  value={Math.round(selectedEl.size.height)}
                  onChange={(e) =>
                    updateElement(selectedEl.id, {
                      size: { ...selectedEl.size, height: Number(e.target.value) },
                    })
                  }
                />
              </PropField>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  updateElement(selectedEl.id, { rotation: (selectedEl.rotation + 45) % 360 })
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                <FiRotateCw size={14} /> Rotate
              </button>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50"
              >
                <FiTrash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
