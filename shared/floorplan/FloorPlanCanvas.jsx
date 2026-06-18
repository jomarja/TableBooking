import { useRef } from 'react';
import {
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  TABLE_COLORS,
  ELEMENT_STYLES,
  toPxX,
  toPxY,
} from './constants.js';

/**
 * The SINGLE shared floor-plan renderer used by both the customer app
 * (view mode) and the portal builder (edit mode). It renders directly from
 * `elements` (decor + table elements) and `tables`. There is no translated
 * second format — whatever the builder saves is what the customer sees.
 *
 * Props:
 *  - elements: FloorPlanElement[]  ({ id, type, position:{x,y}, size:{w,h}, rotation, metadata })
 *  - tables:   Table[]             ({ id, number, capacity, shape, position, size, tags, ... })
 *  - background?: string           image url drawn behind everything
 *  - getTableStatus(table) => 'available'|'selected'|'occupied'|'blocked'|'disabled'
 *  - onTableClick(table), onTableHover(tableOrNull)
 *  - hoveredTableId, selectedTableId
 *  - tooltipFor(table) => string   custom tooltip text (view mode)
 *  - editable: boolean             when true, exposes pointer handlers for the builder
 *  - selectedElementId, onElementPointerDown(e, element)
 *  - svgRef                        forwarded ref to the <svg> (builder needs it for coords)
 */
export default function FloorPlanCanvas({
  elements = [],
  tables = [],
  background = null,
  getTableStatus = () => 'available',
  onTableClick = () => {},
  onTableHover = () => {},
  hoveredTableId = null,
  selectedTableId = null,
  tooltipFor = null,
  editable = false,
  selectedElementId = null,
  onElementPointerDown = () => {},
  onCanvasPointerDown = () => {},
  svgRef = null,
}) {
  const innerRef = useRef(null);
  const ref = svgRef || innerRef;

  const tableByElementId = new Map();
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  // Decor elements first (so tables render on top).
  const decorElements = elements.filter((e) => e.type !== 'table');
  const tableElements = elements.filter((e) => e.type === 'table');

  const renderDecor = (el) => {
    const style = ELEMENT_STYLES[el.type] || {
      fill: '#E5E7EB',
      stroke: '#9CA3AF',
      text: '#374151',
    };
    const x = toPxX(el.position.x);
    const y = toPxY(el.position.y);
    const w = toPxX(el.size.width);
    const h = toPxY(el.size.height);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const label = el.metadata?.label || el.type.toUpperCase();
    const isSel = editable && selectedElementId === el.id;
    const dashed = ['kitchen', 'bar', 'terrace', 'wc'].includes(el.type);

    return (
      <g
        key={el.id}
        transform={el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined}
        onPointerDown={editable ? (e) => onElementPointerDown(e, el) : undefined}
        style={{ cursor: editable ? 'move' : 'default' }}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={el.type === 'window' || el.type === 'wall' ? 2 : 6}
          fill={style.fill}
          stroke={isSel ? '#2563EB' : style.stroke}
          strokeWidth={isSel ? 3 : 1.5}
          strokeDasharray={dashed ? '5,3' : undefined}
          opacity={el.type === 'window' ? 0.9 : 0.85}
        />
        {!['window', 'wall', 'plant', 'ac'].includes(el.type) && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={style.text}
            fontSize="13"
            fontWeight="bold"
          >
            {label}
          </text>
        )}
        {el.type === 'plant' && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(w, h)}>
            🪴
          </text>
        )}
        {el.type === 'ac' && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="12">
            ❄
          </text>
        )}
      </g>
    );
  };

  const renderTable = (table, el) => {
    if (!table) return null;
    const status = getTableStatus(table);
    const color = TABLE_COLORS[status] || TABLE_COLORS.available;
    // Prefer the linked element's geometry (builder source of truth);
    // fall back to the table's own position/size.
    const pos = el
      ? { x: el.position.x + el.size.width / 2, y: el.position.y + el.size.height / 2 }
      : table.position;
    const size = el ? el.size : table.size;
    const cx = toPxX(pos.x);
    const cy = toPxY(pos.y);
    const w = toPxX(size.width);
    const h = toPxY(size.height);
    const isHovered = hoveredTableId === table.id;
    const isSelected = selectedTableId === table.id || selectedElementId === el?.id;
    const isCircle = table.shape === 'CIRCLE' || table.shape === 'circle';
    const clickable = status === 'available' || status === 'selected';
    const tip = tooltipFor
      ? tooltipFor(table)
      : `Table ${table.number} · ${table.capacity} seats`;

    const handlePointerDown = editable && el ? (e) => onElementPointerDown(e, el) : undefined;

    return (
      <g
        key={table.id}
        onPointerDown={handlePointerDown}
        onClick={editable ? undefined : () => clickable && onTableClick(table)}
        onMouseEnter={() => onTableHover(table)}
        onMouseLeave={() => onTableHover(null)}
        style={{
          cursor: editable ? 'move' : clickable ? 'pointer' : 'not-allowed',
        }}
      >
        {isCircle ? (
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(w, h) / 2 + (isHovered ? 2 : 0)}
            fill={color}
            stroke={isSelected ? '#111827' : isHovered ? '#1F2937' : 'transparent'}
            strokeWidth={isSelected ? 3 : 2}
            opacity={status === 'disabled' ? 0.5 : 1}
          />
        ) : (
          <rect
            x={cx - w / 2 - (isHovered ? 2 : 0)}
            y={cy - h / 2 - (isHovered ? 2 : 0)}
            width={w + (isHovered ? 4 : 0)}
            height={h + (isHovered ? 4 : 0)}
            rx="8"
            fill={color}
            stroke={isSelected ? '#111827' : isHovered ? '#1F2937' : 'transparent'}
            strokeWidth={isSelected ? 3 : 2}
            opacity={status === 'disabled' ? 0.5 : 1}
          />
        )}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="13"
          fontWeight="bold"
        >
          {table.number}
        </text>
        {isHovered && !editable && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={cx - 80}
              y={cy - h / 2 - 34}
              width="160"
              height="24"
              rx="4"
              fill="#1F2937"
              opacity="0.92"
            />
            <text x={cx} y={cy - h / 2 - 18} textAnchor="middle" fill="white" fontSize="11">
              {tip}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="w-full h-full"
      style={{ fontFamily: 'sans-serif', touchAction: 'none' }}
      onPointerDown={editable ? onCanvasPointerDown : undefined}
    >
      {/* Floor backdrop */}
      <rect
        x="0"
        y="0"
        width={VIEWBOX_WIDTH}
        height={VIEWBOX_HEIGHT}
        rx="8"
        fill="#FAFAFA"
        stroke="#374151"
        strokeWidth="3"
      />
      {background && (
        <image
          href={background}
          x="0"
          y="0"
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          opacity="0.35"
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {decorElements.map(renderDecor)}

      {/* Tables: prefer table elements (builder geometry); else free tables. */}
      {tableElements.map((el) => {
        const tableId = el.metadata?.tableId;
        const table = tableId ? tablesById.get(tableId) : null;
        if (table) tableByElementId.set(el.id, table.id);
        return renderTable(table, el);
      })}
      {tables
        .filter((t) => ![...tableByElementId.values()].includes(t.id))
        .map((t) => renderTable(t, null))}
    </svg>
  );
}
