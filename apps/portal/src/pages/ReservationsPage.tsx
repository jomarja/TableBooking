import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FiPlus, FiChevronLeft, FiChevronRight, FiCheck, FiBell, FiRefreshCw, FiRotateCcw, FiEdit2, FiUserCheck, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { BlockedPeriod, Reservation, Restaurant, TableModel } from '../types';
import { ReservationModal } from '../components/ReservationModal';
import { ChannelIcon, channelMeta } from '../components/channel';
import { resourceLabel } from '../lib/resources';

type View = 'day' | 'week' | 'table';

const DEFAULT_OPEN = 10 * 60; // fallback opening time if restaurant has none
const DEFAULT_CLOSE = 23 * 60; // fallback closing time
const DEFAULT_DURATION = 120; // default reservation length in minutes
const DEFAULT_PX_PER_HOUR = 90;
const MIN_PX_PER_HOUR = 44;
const MAX_PX_PER_HOUR = 220;
const ROW_H = 64;
const MIN_PER_DAY = 24 * 60;
const AUTOSCROLL_EDGE = 56; // px from top/bottom edge that triggers auto-scroll while dragging
const AUTOSCROLL_MAX = 20; // max auto-scroll speed in px per frame
// How many days the timeline spans. The selected day is first; scrolling right
// reveals the following day(s) with their own hours and real reservations.
const WINDOW_DAYS = 2;

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToLabel(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
// Human duration like "2h 30m" / "90m" → used in the live drag/resize preview.
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function addDays(date: string, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const todayStr = () => new Date().toISOString().slice(0, 10);

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Current time in ms, refreshed every 30s so "now" line + colours stay live.
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Resolve the open/close window (in minutes) for a given date, preferring the
// per-weekday openingHours map and falling back to the flat opening/closing
// times. Closing times at or before opening (e.g. 00:00) are treated as the
// next day so the window is always a forward range.
function openCloseForDate(restaurant: Restaurant | null, date: string) {
  let open = DEFAULT_OPEN;
  let close = DEFAULT_CLOSE;
  if (restaurant) {
    const key = WEEKDAY_KEYS[new Date(date).getDay()];
    const hours = restaurant.openingHours?.[key];
    const openStr = hours?.open || restaurant.openingTime;
    const closeStr = hours?.close || restaurant.closingTime;
    if (openStr) open = toMin(openStr);
    if (closeStr) close = toMin(closeStr);
  }
  if (close <= open) close += 24 * 60;
  return { open, close };
}

// Absolute epoch-minutes for a reservation's start/end, handling overnight.
function resEpochRange(r: Reservation) {
  const start = new Date(`${r.date}T${r.startTime}`).getTime();
  let end = new Date(`${r.date}T${r.endTime}`).getTime();
  if (end <= start) end += 24 * 60 * 60 * 1000; // crosses midnight
  return { start, end };
}

type ResVisual = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled';

// Colour driven by status, with one time-based rule: a booking whose end time
// has already passed renders as COMPLETED (gray, reduced emphasis) regardless
// of its stored status, so the past reads as "done" at a glance. Cancelled is
// always the muted struck-through state.
function reservationVisual(r: Reservation, nowMs?: number): ResVisual {
  if (r.status === 'CANCELLED') return 'cancelled';
  if (r.status === 'COMPLETED') return 'completed';
  if (nowMs !== undefined && nowMs >= resEpochRange(r).end) return 'completed';
  if (r.status === 'SEATED') return 'seated';
  if (r.status === 'PENDING') return 'pending';
  return 'confirmed';
}

// Tailwind classes per visual state (block background + text). Per the status
// palette: pending=orange, confirmed=brand indigo/purple, seated=yellow,
// completed/cancelled=gray (cancelled struck through).
const VISUAL_CLASS: Record<ResVisual, string> = {
  pending: 'bg-orange-500 hover:bg-orange-600 text-white',
  confirmed: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  seated: 'bg-amber-400 hover:bg-amber-500 text-amber-950',
  completed: 'bg-slate-400 hover:bg-slate-500 text-white',
  cancelled: 'bg-slate-300 text-slate-600 line-through',
};

// Matching dot colour for the day-list rows.
const VISUAL_DOT: Record<ResVisual, string> = {
  pending: 'bg-orange-500',
  confirmed: 'bg-indigo-600',
  seated: 'bg-amber-400',
  completed: 'bg-slate-400',
  cancelled: 'bg-slate-300',
};

export default function ReservationsPage() {
  const { restaurant } = useAuth();
  const [view, setView] = useState<View>('table');
  const [date, setDate] = useState(todayStr());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocked, setBlocked] = useState<BlockedPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  // create modal: false = closed, true = blank, object = prefilled (double-click)
  const [creating, setCreating] = useState<
    boolean | { tableId: string; startTime: string; date: string }
  >(false);
  // Scheduler setting: show the current-time indicator (default ON, persisted).
  const [showNowLine, setShowNowLine] = useState(
    () => localStorage.getItem('tb_showNowLine') !== '0',
  );
  const toggleNowLine = useCallback(() => {
    setShowNowLine((v) => {
      localStorage.setItem('tb_showNowLine', v ? '0' : '1');
      return !v;
    });
  }, []);
  const now = useNow();

  // The timeline spans WINDOW_DAYS consecutive days laid out on one continuous
  // axis (day 0 at minute 0, day 1 at minute 1440, …). Each day carries its own
  // open/close window so scrolling right shows the next day's real hours + data.
  const days = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, i) => {
        const dStr = addDays(date, i);
        const { open, close } = openCloseForDate(restaurant, dStr);
        return {
          index: i,
          date: dStr,
          openAbs: i * MIN_PER_DAY + open,
          closeAbs: i * MIN_PER_DAY + close,
        };
      }),
    [restaurant, date],
  );
  const dayIndexOf = useCallback(
    (dStr: string) => days.findIndex((d) => d.date === dStr),
    [days],
  );
  const defaultDuration = restaurant?.reservationRules?.defaultDurationMinutes || DEFAULT_DURATION;

  const tables: TableModel[] = useMemo(
    () => [...(restaurant?.tables || [])].sort((a, b) => a.number - b.number),
    [restaurant],
  );
  const zoneName = useCallback(
    (zoneId: string | null) => restaurant?.zones.find((z) => z.id === zoneId)?.name || 'Unzoned',
    [restaurant],
  );
  // Row/resource label: custom resource name (Resource List mode) or "Table N".
  const tableLabel = useCallback((t: TableModel) => resourceLabel(restaurant, t), [restaurant]);
  const tableLabelById = useCallback(
    (id: string | null) => {
      const t = tables.find((x) => x.id === id);
      return t ? tableLabel(t) : '—';
    },
    [tables, tableLabel],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dayDates = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(date, i));
      const [resByDay, blk] = await Promise.all([
        Promise.all(dayDates.map((d) => api.listReservations(d))),
        api.listBlocked(),
      ]);
      setReservations(resByDay.flat());
      setBlocked(blk);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-complete: once a SEATED reservation's end time passes it flips to
  // COMPLETED (gray, sticky). Guarded with a ref so each id is PATCHed at most
  // once while the request is in flight, and re-checked on every "now" tick.
  const completingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const due = reservations.filter(
      (r) =>
        r.status === 'SEATED' &&
        now >= resEpochRange(r).end &&
        !completingRef.current.has(r.id),
    );
    if (!due.length) return;
    due.forEach((r) => completingRef.current.add(r.id));
    void Promise.all(due.map((r) => api.updateReservation(r.id, { status: 'COMPLETED' })))
      .then(() => load())
      .finally(() => due.forEach((r) => completingRef.current.delete(r.id)));
  }, [reservations, now, load]);

  // Blocked periods affecting a given date (SINGLE on date, or RECURRING by weekday/monthday).
  const blocksForDate = useCallback(
    (dStr: string) => {
      const d = new Date(dStr);
      const weekday = d.getDay();
      const monthday = d.getDate();
      return blocked.filter((b) => {
        if (b.type === 'SINGLE') return b.date === dStr;
        const r = b.recurrenceRule;
        if (!r) return false;
        if (r.freq === 'WEEKLY') return r.byWeekday === undefined || r.byWeekday === weekday;
        if (r.freq === 'MONTHLY') return r.byMonthDay === undefined || r.byMonthDay === monthday;
        return false;
      });
    },
    [blocked],
  );

  const blocksForTable = useCallback(
    (tableId: string, dStr: string) =>
      blocksForDate(dStr).filter(
        (b) =>
          (b.scope === 'TABLES' && b.tableIds.includes(tableId)) ||
          (b.scope === 'ZONE' && b.zoneId === tables.find((t) => t.id === tableId)?.zoneId),
      ),
    [blocksForDate, tables],
  );

  const onSaved = async () => {
    setEditing(null);
    setCreating(false);
    await load();
  };

  // Quick status changes straight from the timeline (no modal).
  const setStatus = useCallback(
    async (r: Reservation, status: Reservation['status']) => {
      await api.updateReservation(r.id, { status });
      await load();
    },
    [load],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reservations</h2>
          <p className="text-slate-500 text-sm">
            Timeline scheduler · drag to move or resize · scroll right for the next day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setDate(addDays(date, -1))} className="px-2 py-2 hover:bg-slate-50">
              <FiChevronLeft />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-2 text-sm focus:outline-none"
            />
            <button onClick={() => setDate(addDays(date, 1))} className="px-2 py-2 hover:bg-slate-50">
              <FiChevronRight />
            </button>
            <button
              onClick={() => setDate(todayStr())}
              disabled={date === todayStr()}
              className="px-3 py-2 text-sm font-medium border-l border-slate-200 text-indigo-600 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
              title="Jump to today"
            >
              Today
            </button>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
            {(['table', 'day', 'week'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 capitalize ${
                  view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={toggleNowLine}
            role="switch"
            aria-checked={showNowLine}
            className={`p-2 rounded-lg border transition-colors ${
              showNowLine
                ? 'border-red-200 bg-red-50 text-red-500'
                : 'border-slate-200 text-slate-400 hover:bg-white'
            }`}
            title={`${showNowLine ? 'Hide' : 'Show'} current-time indicator`}
          >
            <FiClock size={16} />
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50"
            title="Reload"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <FiPlus /> Manual
          </button>
        </div>
      </div>

      {/* Fixed-height slot so showing/hiding the loading hint never reflows the
          timeline below it — toggling a flow element here made the whole table
          jump down and back up ("jiggle") on every drag-drop reload. */}
      <div className="h-5">
        {loading && <p className="text-slate-400 text-sm leading-5">Loading…</p>}
      </div>

      {view === 'table' && (
        <TableScheduler
          tables={tables}
          reservations={reservations}
          days={days}
          dayIndexOf={dayIndexOf}
          blocksForTable={blocksForTable}
          zoneName={zoneName}
          tableLabel={tableLabel}
          showNow={showNowLine}
          onEdit={setEditing}
          onChanged={onSaved}
          onConfirm={(r) => setStatus(r, 'CONFIRMED')}
          onArrive={(r) => setStatus(r, 'SEATED')}
          onComplete={(r) => setStatus(r, 'COMPLETED')}
          onCancel={(r) => setStatus(r, 'CANCELLED')}
          onCreateAt={(tableId, dayDate, startMin) => {
            setCreating({ tableId, date: dayDate, startTime: minToLabel(startMin) });
          }}
        />
      )}

      {view === 'day' && (
        <DayList
          reservations={reservations}
          tableLabelById={tableLabelById}
          onEdit={setEditing}
        />
      )}

      {view === 'week' && <WeekView startDate={date} />}

      {(editing || creating) && (
        <ReservationModal
          reservation={editing}
          tables={tables}
          date={typeof creating === 'object' ? creating.date : date}
          initial={typeof creating === 'object' ? creating : undefined}
          defaultDuration={defaultDuration}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

const LABEL_W = 160; // width of the sticky table-label column (w-40)

type DayWindow = { index: number; date: string; openAbs: number; closeAbs: number };

function dateLabel(dStr: string) {
  return new Date(dStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ---- Table-view timeline scheduler with drag move + resize ----
// The axis is a single continuous run of "absolute minutes": day 0 occupies
// [0, 1440), day 1 [1440, 2880), … so scrolling right moves smoothly into the
// next day's real reservations. Each day keeps its own open window (white),
// everything outside it is shaded as closed (gray).
function TableScheduler({
  tables,
  reservations,
  days,
  dayIndexOf,
  blocksForTable,
  zoneName,
  tableLabel,
  showNow,
  onEdit,
  onChanged,
  onConfirm,
  onArrive,
  onComplete,
  onCancel,
  onCreateAt,
}: {
  tables: TableModel[];
  reservations: Reservation[];
  days: DayWindow[];
  dayIndexOf: (date: string) => number;
  blocksForTable: (id: string, date: string) => BlockedPeriod[];
  zoneName: (id: string | null) => string;
  tableLabel: (t: TableModel) => string;
  showNow: boolean;
  onEdit: (r: Reservation) => void;
  onChanged: (notify: boolean, id?: string) => void;
  onConfirm: (r: Reservation) => void;
  onArrive: (r: Reservation) => void;
  onComplete: (r: Reservation) => void;
  onCancel: (r: Reservation) => void;
  onCreateAt: (tableId: string, date: string, startMin: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerHour, setPxPerHour] = useState(DEFAULT_PX_PER_HOUR);
  const maxAbs = WINDOW_DAYS * MIN_PER_DAY; // exclusive upper bound for positions
  const now = useNow();

  // Zoom that keeps the viewport centre fixed (no jump). We mirror pxPerHour in
  // a ref so the wheel/buttons can read the live value, and stash the target
  // scrollLeft to apply *after* the new width lands (layout effect below).
  const pxPerHourRef = useRef(pxPerHour);
  pxPerHourRef.current = pxPerHour;
  const rangeStartRef = useRef(0); // mirrors rangeStart for the scroll handler
  const pendingScrollLeftRef = useRef<number | null>(null);
  const applyZoom = useCallback((next: number) => {
    const el = scrollRef.current;
    const prev = pxPerHourRef.current;
    const clamped = Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, next));
    if (clamped === prev) return;
    if (el) {
      // Axis-x under the viewport centre stays put: newScrollLeft keeps the
      // same content point centred after the scale changes by clamped/prev.
      const a = el.scrollLeft + el.clientWidth / 2 - LABEL_W;
      pendingScrollLeftRef.current = LABEL_W + a * (clamped / prev) - el.clientWidth / 2;
    }
    setPxPerHour(clamped);
  }, []);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingScrollLeftRef.current != null) {
      el.scrollLeft = Math.max(0, pendingScrollLeftRef.current);
      pendingScrollLeftRef.current = null;
    }
  }, [pxPerHour]);

  // Floating day indicator: track which day sits at the left of the visible
  // grid so a small pill can always show the current day while scrolling across
  // the window. rAF-throttled; only re-renders when the day actually changes.
  const [inViewDay, setInViewDay] = useState(0);
  const scrollRafRef = useRef<number | null>(null);
  const onSchedScroll = useCallback(() => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const leftAbs = rangeStartRef.current + (el.scrollLeft / pxPerHourRef.current) * 60;
      const idx = Math.min(Math.max(Math.floor(leftAbs / MIN_PER_DAY), 0), WINDOW_DAYS - 1);
      setInViewDay((prev) => (prev === idx ? prev : idx));
    });
  }, []);

  // "Now" as an absolute axis-minute, if today falls inside the window.
  const nowAbs = useMemo(() => {
    const idx = days.findIndex((d) => d.date === new Date(now).toISOString().slice(0, 10));
    if (idx < 0) return null;
    const d = new Date(now);
    return idx * MIN_PER_DAY + d.getHours() * 60 + d.getMinutes();
  }, [days, now]);

  // Axis range (absolute minutes): from the first day's opening hour to the
  // midnight after the last day, so every hour — open (white) and closed
  // (gray) — has a real grid slot. The width is derived purely from zoom; any
  // empty space on very wide screens is filled by a CSS flex spacer below,
  // never by re-measuring the viewport (which caused a resize feedback loop).
  // Axis normally starts at the first day's opening hour, but never later than
  // "now" — so the current-time line is always on-axis and visible even outside
  // working hours (after close, or in the small hours before open). When "now"
  // is earlier than opening we begin an hour ahead of it so the red line lands
  // inside the grid with breathing room, not glued to the table-label column.
  const rangeStart = useMemo(() => {
    let s = Math.floor(days[0].openAbs / 60) * 60;
    if (nowAbs !== null && nowAbs < s) s = Math.max(0, Math.floor((nowAbs - 60) / 60) * 60);
    return s;
  }, [days, nowAbs]);
  rangeStartRef.current = rangeStart;
  const rangeEnd = WINDOW_DAYS * MIN_PER_DAY;
  const width = ((rangeEnd - rangeStart) / 60) * pxPerHour;

  // White "open" bands, clipped to the visible range.
  const openBands = useMemo(
    () =>
      days
        .map((d) => ({ from: Math.max(d.openAbs, rangeStart), to: Math.min(d.closeAbs, rangeEnd) }))
        .filter((b) => b.to > b.from),
    [days, rangeStart, rangeEnd],
  );
  const isOpen = useCallback(
    (absMin: number) => openBands.some((b) => absMin >= b.from && absMin < b.to),
    [openBands],
  );

  // One header chip per day, spanning that day's slice of the axis.
  const dayMarkers = useMemo(
    () =>
      days
        .map((d) => ({
          date: d.date,
          from: Math.max(d.index * MIN_PER_DAY, rangeStart),
          to: Math.min((d.index + 1) * MIN_PER_DAY, rangeEnd),
        }))
        .filter((m) => m.to > m.from),
    [days, rangeStart, rangeEnd],
  );

  // drag state — kept in a ref so pointermove/pointerup handlers are stable.
  // `edge` distinguishes which side a resize grabs (left = start, right = end).
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    edge?: 'start' | 'end';
    startX: number;
    origStart: number;
    origEnd: number;
    origTableId: string | null;
  } | null>(null);
  // pan state — drag the empty background to scroll the timeline in 2D
  // (left/right + up/down), Figma/Miro style.
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  // edge auto-scroll while dragging a reservation up/down: keeps scrolling the
  // rows while the pointer rests near the top/bottom edge, so off-screen tables
  // can be reached without releasing to use the scrollbar (mirrors left/right).
  const autoScrollRef = useRef<{ vy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // committed overrides — set optimistically when drag ends, cleared after save
  const [overrides, setOverrides] = useState<
    Record<string, { start: number; end: number; tableId: string | null }>
  >({});
  const [preview, setPreview] = useState<{
    id: string;
    mode: 'move' | 'resize';
    start: number;
    end: number;
    tableId: string | null;
    valid: boolean; // false when the current spot overlaps another booking
  } | null>(null);
  // Right-click context menu (quick actions) anchored at the cursor.
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; res: Reservation } | null>(null);

  // All tick positions across the visible range: whole hours + half hours.
  // Stop *before* rangeEnd so there's no dangling "00:00" tick/label hanging
  // past the last real slot (the stray empty column at the right edge).
  const ticks = useMemo(() => {
    const t: { min: number; isHour: boolean }[] = [];
    for (let m = rangeStart; m < rangeEnd; m += 30) {
      t.push({ min: m, isHour: m % 60 === 0 });
    }
    return t;
  }, [rangeStart, rangeEnd]);

  const grouped = useMemo(() => {
    const map = new Map<string, TableModel[]>();
    for (const t of tables) {
      const z = zoneName(t.zoneId);
      if (!map.has(z)) map.set(z, []);
      map.get(z)!.push(t);
    }
    return Array.from(map.entries());
  }, [tables, zoneName]);


  const minToX = useCallback(
    (min: number) => ((min - rangeStart) / 60) * pxPerHour,
    [rangeStart, pxPerHour],
  );
  const snap = (min: number) => Math.round(min / 15) * 15;
  const zoomPct = Math.round((pxPerHour / DEFAULT_PX_PER_HOUR) * 100);

  // Convert an absolute-minute position back to a concrete day + HH:MM string.
  const absToParts = useCallback(
    (abs: number) => {
      const idx = Math.min(Math.max(Math.floor(abs / MIN_PER_DAY), 0), WINDOW_DAYS - 1);
      return { date: days[idx].date, baseAbs: idx * MIN_PER_DAY };
    },
    [days],
  );

  // Reservation start/end as absolute minutes on the multi-day axis.
  const resAbs = useCallback(
    (r: Reservation) => {
      const idx = Math.max(dayIndexOf(r.date), 0);
      let s = idx * MIN_PER_DAY + toMin(r.startTime);
      let e = idx * MIN_PER_DAY + toMin(r.endTime);
      if (e <= s) e += MIN_PER_DAY; // reservation crossing midnight
      return { start: s, end: e };
    },
    [dayIndexOf],
  );

  // The table a reservation currently lives on, accounting for an in-progress
  // drag (preview) or an optimistic post-drop override, so it renders on the
  // row under the cursor as you move it between tables.
  const effectiveTableId = useCallback(
    (r: Reservation) => {
      if (preview?.id === r.id) return preview.tableId;
      if (overrides[r.id]) return overrides[r.id].tableId;
      return r.tableId;
    },
    [preview, overrides],
  );

  // ---- Collision helpers ----
  // Occupied intervals (abs minutes) from *other* non-cancelled reservations on
  // a table, using their effective (post-drop override) positions. Cancelled
  // bookings never block — they're excluded.
  const occupiedOn = useCallback(
    (tableId: string | null, excludeId: string) => {
      const list: { start: number; end: number }[] = [];
      for (const r of reservations) {
        if (r.id === excludeId || r.status === 'CANCELLED') continue;
        const tid = overrides[r.id]?.tableId ?? r.tableId;
        if (tid !== tableId) continue;
        const o = overrides[r.id];
        list.push(o ? { start: o.start, end: o.end } : resAbs(r));
      }
      return list.sort((a, b) => a.start - b.start);
    },
    [reservations, overrides, resAbs],
  );

  const overlapsAny = (start: number, end: number, occ: { start: number; end: number }[]) =>
    occ.some((o) => start < o.end && end > o.start);

  // Nearest valid start for a block of length `dur` on `tableId`, snapping it
  // before/after existing bookings (whichever gap is closest). null = no room.
  const resolvePlacement = useCallback(
    (tableId: string | null, desiredStart: number, dur: number, excludeId: string) => {
      const lo = rangeStart;
      const hi = Math.min(rangeEnd, maxAbs);
      const occ = occupiedOn(tableId, excludeId);
      // Free gaps within [lo, hi].
      const gaps: { start: number; end: number }[] = [];
      let cursor = lo;
      for (const o of occ) {
        if (o.start > cursor) gaps.push({ start: cursor, end: Math.min(o.start, hi) });
        cursor = Math.max(cursor, o.end);
        if (cursor >= hi) break;
      }
      if (cursor < hi) gaps.push({ start: cursor, end: hi });
      const feasible = gaps.filter((g) => g.end - g.start >= dur);
      if (!feasible.length) return null;
      let best: number | null = null;
      let bestDist = Infinity;
      for (const g of feasible) {
        const clamped = Math.max(g.start, Math.min(desiredStart, g.end - dur));
        const dist = Math.abs(clamped - desiredStart);
        if (dist < bestDist) {
          bestDist = dist;
          best = clamped;
        }
      }
      return best;
    },
    [occupiedOn, rangeStart, rangeEnd, maxAbs],
  );

  // Ctrl+wheel to zoom — one notch ≈ 8 px/hr, normalised for trackpads.
  // Routes through applyZoom so the viewport centre stays put.
  const onWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    // deltaY can be pixels (trackpad) or lines (mouse wheel).
    // Cap the per-event change to ±8 so trackpad swipes feel smooth.
    const raw = e.deltaMode === 0 ? e.deltaY * 0.15 : e.deltaY * 8;
    const delta = Math.sign(raw) * Math.min(Math.abs(raw), 8);
    applyZoom(pxPerHourRef.current - delta);
  }, [applyZoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Compute the live drag preview (block position + target row) for a pointer
  // position. Extracted so the auto-scroll loop can re-run it with the last
  // known pointer while the rows keep scrolling under a held-still cursor.
  const computePreview = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = clientX - drag.startX;
      const deltaMin = (dx / pxPerHour) * 60;
      let start: number, end: number;
      let tableId = drag.origTableId;
      // Follow the cursor freely (no snapping mid-drag) so the block tracks the
      // pointer 1:1 — snapping is applied once, on drop. This removes the
      // back-and-forth jitter near 15-minute boundaries.
      const hi = Math.min(rangeEnd, maxAbs);
      let valid = true;
      if (drag.mode === 'move') {
        const dur = drag.origEnd - drag.origStart;
        start = drag.origStart + deltaMin;
        start = Math.max(rangeStart, Math.min(start, hi - dur));
        end = start + dur;
        // Vertical move: retarget to the nearest table row by cursor-Y. Using
        // the row whose vertical band contains (or is closest to) the cursor —
        // rather than elementFromPoint — keeps the block locked to the cursor
        // even while passing over zone-header strips, which have no row.
        const cells = scrollRef.current?.querySelectorAll<HTMLElement>('[data-table-id]');
        if (cells && cells.length) {
          let bestId = tableId;
          let bestDist = Infinity;
          cells.forEach((cell) => {
            const rect = cell.getBoundingClientRect();
            // distance from cursor-Y to this row's vertical span (0 if inside)
            const dist =
              clientY < rect.top
                ? rect.top - clientY
                : clientY > rect.bottom
                  ? clientY - rect.bottom
                  : 0;
            if (dist < bestDist) {
              bestDist = dist;
              bestId = cell.getAttribute('data-table-id');
            }
          });
          if (bestId) tableId = bestId;
        }
        // Validity = does this exact spot overlap another booking? (We snap to a
        // clear slot on drop; the live red/green just tells the user.)
        valid = !overlapsAny(snap(start), snap(end), occupiedOn(tableId, drag.id));
      } else {
        // Resize: keep the opposite edge fixed and clamp the dragged edge so it
        // can't grow into a neighbouring booking (snaps flush against it).
        const occ = occupiedOn(tableId, drag.id);
        if (drag.edge === 'start') {
          const prevEnd = Math.max(
            rangeStart,
            ...occ.filter((o) => o.start < drag.origEnd && o.end <= drag.origEnd).map((o) => o.end),
          );
          start = drag.origStart + deltaMin;
          start = Math.max(prevEnd, Math.min(start, drag.origEnd - 15));
          end = drag.origEnd;
        } else {
          const nextStart = Math.min(
            hi,
            ...occ.filter((o) => o.end > drag.origStart && o.start >= drag.origStart).map((o) => o.start),
          );
          start = drag.origStart;
          end = drag.origEnd + deltaMin;
          end = Math.max(start + 15, Math.min(end, nextStart));
        }
      }
      setPreview({ id: drag.id, mode: drag.mode, start, end, tableId, valid });
    },
    [pxPerHour, rangeStart, rangeEnd, maxAbs, occupiedOn],
  );

  // The auto-scroll loop must always call the freshest computePreview (which
  // captures the current zoom/range) without restarting the rAF each render.
  const computePreviewRef = useRef(computePreview);
  useEffect(() => {
    computePreviewRef.current = computePreview;
  }, [computePreview]);

  // Set when a new pointer position (or auto-scroll step) needs the preview
  // recomputed. The rAF loop coalesces bursts of pointermove events into one
  // recompute+render per frame — without this, dragging re-rendered the whole
  // grid on every raw move event (often >60/s, unsynced to paint), which made
  // the block stutter and lag behind the cursor.
  const dragDirtyRef = useRef(false);

  // Vertical edge auto-scroll speed from how far into the top/bottom edge zone
  // the cursor sits (0 when outside the zone).
  const edgeVelocity = useCallback((clientY: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top + AUTOSCROLL_EDGE) {
      const over = rect.top + AUTOSCROLL_EDGE - clientY;
      return -Math.min(AUTOSCROLL_MAX, (over / AUTOSCROLL_EDGE) * AUTOSCROLL_MAX);
    }
    if (clientY > rect.bottom - AUTOSCROLL_EDGE) {
      const over = clientY - (rect.bottom - AUTOSCROLL_EDGE);
      return Math.min(AUTOSCROLL_MAX, (over / AUTOSCROLL_EDGE) * AUTOSCROLL_MAX);
    }
    return 0;
  }, []);

  // One loop runs for the whole drag: apply any edge auto-scroll, then recompute
  // the preview at most once per frame (only when something actually changed).
  const dragTick = useCallback(() => {
    if (!dragRef.current) {
      rafRef.current = null;
      return;
    }
    const el = scrollRef.current;
    const vy = autoScrollRef.current?.vy ?? 0;
    if (el && vy) {
      const max = el.scrollHeight - el.clientHeight;
      const next = Math.max(0, Math.min(max, el.scrollTop + vy));
      if (next !== el.scrollTop) {
        el.scrollTop = next;
        dragDirtyRef.current = true; // scrolling moved the rows under the cursor
      }
    }
    if (dragDirtyRef.current) {
      dragDirtyRef.current = false;
      computePreviewRef.current(lastPointer.current.x, lastPointer.current.y);
    }
    rafRef.current = requestAnimationFrame(dragTick);
  }, []);

  // Start a 2D pan from the current pointer + scroll position.
  const beginPan = useCallback((clientX: number, clientY: number) => {
    if (!scrollRef.current) return;
    panRef.current = {
      startX: clientX,
      startY: clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      // Panning the background: scroll the container opposite the drag, in 2D.
      if (panRef.current && scrollRef.current) {
        scrollRef.current.scrollLeft =
          panRef.current.scrollLeft - (e.clientX - panRef.current.startX);
        scrollRef.current.scrollTop =
          panRef.current.scrollTop - (e.clientY - panRef.current.startY);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      // Record the pointer and mark dirty; the rAF loop does the actual work so
      // we never recompute/render more than once per frame.
      lastPointer.current = { x: e.clientX, y: e.clientY };
      dragDirtyRef.current = true;
      // Only a move retargets rows / needs the vertical edge auto-scroll.
      autoScrollRef.current = drag.mode === 'move' ? { vy: edgeVelocity(e.clientY) } : null;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(dragTick);
    },
    [edgeVelocity, dragTick],
  );

  const onPointerUp = useCallback(async () => {
    panRef.current = null;
    // stop the per-frame drag loop + any in-flight edge auto-scroll
    autoScrollRef.current = null;
    dragDirtyRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    setPreview((prev) => {
      if (!prev || prev.id !== drag.id) return null;
      const res = reservations.find((r) => r.id === drag.id);
      if (!res) return null;
      // Snap to the 15-minute grid now, on release (kept free during the drag),
      // and resolve any overlap so the result is always collision-free.
      const hi = Math.min(rangeEnd, maxAbs);
      let snapStart: number, snapEnd: number;
      if (prev.mode === 'move') {
        const dur = prev.end - prev.start;
        const desired = Math.max(rangeStart, Math.min(snap(prev.start), hi - dur));
        const resolved = resolvePlacement(prev.tableId, desired, dur, drag.id);
        if (resolved == null) return null; // table is full → cancel the move
        snapStart = resolved;
        snapEnd = snapStart + dur;
      } else {
        const occ = occupiedOn(prev.tableId, drag.id);
        if (drag.edge === 'start') {
          const prevEnd = Math.max(rangeStart, ...occ.filter((o) => o.end <= prev.end).map((o) => o.end));
          snapEnd = prev.end;
          snapStart = Math.min(snapEnd - 15, Math.max(prevEnd, snap(prev.start)));
        } else {
          const nextStart = Math.min(hi, ...occ.filter((o) => o.start >= prev.start).map((o) => o.start));
          snapStart = prev.start;
          snapEnd = Math.max(snapStart + 15, Math.min(nextStart, snap(prev.end)));
        }
      }
      const { date: newDate, baseAbs } = absToParts(snapStart);
      const newStart = minToLabel(snapStart - baseAbs);
      const newEnd = minToLabel(snapEnd - baseAbs);
      const newTableId = prev.tableId;
      if (
        newDate === res.date &&
        newStart === res.startTime &&
        newEnd === res.endTime &&
        newTableId === res.tableId
      )
        return null;

      // Moving a reservation sends it back to PENDING (it needs the customer to
      // be re-notified and re-confirmed) — unless it's already in a terminal /
      // in-progress state we shouldn't disturb: seated guests stay seated and
      // completed/cancelled bookings keep their (sticky gray / muted) status.
      const resetToPending = !['SEATED', 'COMPLETED', 'CANCELLED'].includes(res.status);

      // Optimistic commit so block stays at dropped position during the API call
      setOverrides((o) => ({
        ...o,
        [drag.id]: { start: snapStart, end: snapEnd, tableId: newTableId },
      }));

      api
        .updateReservation(res.id, {
          date: newDate,
          startTime: newStart,
          endTime: newEnd,
          ...(newTableId !== res.tableId ? { tableId: newTableId ?? undefined } : {}),
          ...(resetToPending ? { status: 'PENDING' as const } : {}),
        })
        .then((result) => {
          onChanged(result.notifyCustomer, res.id);
        })
        .finally(() => {
          setOverrides((o) => {
            const next = { ...o };
            delete next[drag.id];
            return next;
          });
        });
      return null;
    });
  }, [reservations, onChanged, absToParts, rangeStart, rangeEnd, maxAbs, resolvePlacement, occupiedOn]);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Label visibility: show :30 labels only when there's enough room
  const showHalfLabels = pxPerHour >= 70;

  return (
    <>
    <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Floating day indicator — always shows which day is in view so staff
          never lose orientation while scrolling across the window. */}
      {days[inViewDay] && (
        <div className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 z-30 bg-slate-800/90 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-md">
          {dateLabel(days[inViewDay].date)}
        </div>
      )}
      <div
        ref={scrollRef}
        className="tb-scroll select-none"
        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 14rem)' }}
        onScroll={onSchedScroll}
        onPointerDown={(e) => {
          // Middle-mouse drag pans from anywhere (Figma/Miro style); trackpad
          // and touch already pan natively via the scroll container.
          if (e.button === 1) {
            e.preventDefault();
            beginPan(e.clientX, e.clientY);
          }
        }}
      >
        {/* Exact content width: the grid ends precisely at the last slot so no
            empty filler column appears after it. On wider viewports the area to
            the right is just the (white) card background — continuous, no gap. */}
        <div style={{ width: width + LABEL_W }}>
          {/* Header row: table label column + time axis */}
          <div className="flex sticky top-0 z-20 select-none" style={{ background: '#f8fafc' }}>
            {/* Table column header — holds the zoom controls. Sticky on the X
                axis too so it stays pinned while the timeline scrolls. */}
            <div className="w-40 flex-shrink-0 sticky left-0 z-20 flex flex-col justify-between px-3 py-2 border-b border-r border-slate-200" style={{ background: '#f8fafc' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Table</span>
                <span className="text-[10px] font-medium text-slate-400 tabular-nums">{zoomPct}%</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => applyZoom(pxPerHour - 16)}
                  disabled={pxPerHour <= MIN_PX_PER_HOUR}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-base font-medium flex items-center justify-center leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Zoom out"
                  aria-label="Zoom out"
                >−</button>
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${((pxPerHour - MIN_PX_PER_HOUR) / (MAX_PX_PER_HOUR - MIN_PX_PER_HOUR)) * 100}%` }}
                  />
                </div>
                <button
                  onClick={() => applyZoom(pxPerHour + 16)}
                  disabled={pxPerHour >= MAX_PX_PER_HOUR}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-base font-medium flex items-center justify-center leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Zoom in"
                  aria-label="Zoom in"
                >+</button>
                <button
                  onClick={() => applyZoom(DEFAULT_PX_PER_HOUR)}
                  disabled={pxPerHour === DEFAULT_PX_PER_HOUR}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Reset zoom"
                  aria-label="Reset zoom to default"
                ><FiRotateCcw size={12} /></button>
              </div>
            </div>

            {/* Time axis — gray base (closed) with white open-hours bands */}
            <div className="relative border-b border-slate-200 bg-slate-100 flex-shrink-0" style={{ width }}>
              {openBands.map((b) => (
                <div
                  key={b.from}
                  className="absolute inset-y-0 bg-white"
                  style={{ left: minToX(b.from), width: minToX(b.to) - minToX(b.from) }}
                />
              ))}
              {/* dim the elapsed part of the day */}
              {nowAbs !== null && nowAbs > rangeStart && (
                <div
                  className="absolute inset-y-0 left-0 bg-slate-900/[0.06]"
                  style={{ width: minToX(Math.min(nowAbs, rangeEnd)) }}
                />
              )}
              {/* current-time marker + time pill. The sticky label-column header
                  (z-20) is opaque and clips this (z-10) at the edge. The pill sits
                  to the *right* of the line so it's never tucked under the column. */}
              {showNow && nowAbs !== null && nowAbs >= rangeStart && nowAbs <= rangeEnd && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: minToX(nowAbs) }}>
                  <div className="absolute inset-y-0 left-0 w-0.5 bg-red-500/70" />
                  <span className="absolute bottom-0.5 left-1 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {minToLabel(nowAbs % MIN_PER_DAY)}
                  </span>
                </div>
              )}
              {/* day chips + boundary lines */}
              {dayMarkers.map((m, i) => (
                <div key={m.date} className="absolute top-0 bottom-0" style={{ left: minToX(m.from) }}>
                  {i > 0 && <div className="absolute inset-y-0 left-0 border-l-2 border-slate-300" />}
                  <span className="absolute top-1.5 left-2 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                    {dateLabel(m.date)}
                  </span>
                </div>
              ))}
              {ticks.map(({ min, isHour }) => {
                const x = minToX(min);
                const open = isOpen(min);
                const label = `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
                return (
                  <div
                    key={min}
                    className="absolute top-0 bottom-0"
                    style={{ left: x }}
                  >
                    {/* tick line */}
                    <div className={`absolute inset-y-0 left-0 border-l ${
                      isHour ? 'border-slate-300' : 'border-slate-200 border-dashed'
                    }`} />
                    {/* label — hour labels always shown, half-hour only when zoomed in.
                        Sits below the day chip so the two never collide. */}
                    {(isHour || showHalfLabels) && (
                      <span
                        className={`absolute left-1.5 whitespace-nowrap ${
                          isHour
                            ? `bottom-1.5 text-xs font-semibold ${open ? 'text-slate-700' : 'text-slate-400'}`
                            : 'bottom-1.5 text-[10px] text-slate-400'
                        }`}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* spacer so the header has height for the day chip + hour labels */}
              <div className="invisible py-5 text-xs">00:00</div>
            </div>
          </div>

          {/* Body — relative so the now-line can span every row as one
              continuous overlay (drawn above the zone strips, borders and
              shading, but beneath the sticky label column which is z-10). */}
          <div className="relative">
          {/* Rows grouped by zone */}
          {grouped.map(([zone, zoneTables]) => (
            <div key={zone}>
              {/* relative z-10 lifts the whole strip ABOVE the now-line (z-5) so
                  the line passes *behind* the zone header; the translucent bg
                  lets it show through only faintly (reduced opacity). */}
              <div
                className="relative z-10 py-1 bg-slate-100/80 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  // Mouse left-drag pans here; touch/trackpad pan natively.
                  if (e.pointerType !== 'mouse' || e.button !== 0) return;
                  beginPan(e.clientX, e.clientY);
                }}
              >
                {/* full-width (LABEL_W) opaque sticky cover over the label column
                    so the now-line is never visible inside it on zone rows; z-20
                    sits above the line and the translucent strip. */}
                <span className="sticky left-0 z-20 block w-40 px-3 bg-slate-100">{zone}</span>
              </div>
              {zoneTables.map((t) => {
                const rows = reservations.filter((r) => effectiveTableId(r) === t.id);
                // While moving a reservation, light up the row under the cursor
                // in green (valid drop) or red (would overlap — gets snapped clear
                // on release). No glow on rows you're not hovering.
                const isDropTarget = preview?.mode === 'move' && preview.tableId === t.id;
                const dropOk = isDropTarget && preview!.valid;
                return (
                  <div
                    key={t.id}
                    className={`flex border-b transition-colors ${
                      isDropTarget
                        ? dropOk
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-red-300 bg-red-50/60'
                        : 'border-slate-100 hover:bg-slate-50/40'
                    }`}
                  >
                    <div
                      className={`w-40 flex-shrink-0 sticky left-0 z-10 px-3 py-3 text-sm border-r transition-colors ${
                        isDropTarget
                          ? dropOk
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                          : 'bg-white border-slate-100'
                      }`}
                    >
                      <span className="font-medium text-slate-700">{tableLabel(t)}</span>
                      <span className="text-slate-400 text-xs block">{t.capacity} seats</span>
                    </div>
                    <div
                      data-table-id={t.id}
                      className={`relative flex-shrink-0 transition-colors cursor-grab active:cursor-grabbing ${
                        isDropTarget
                          ? dropOk
                            ? 'bg-emerald-50/60 ring-2 ring-inset ring-emerald-300'
                            : 'bg-red-50/60 ring-2 ring-inset ring-red-300'
                          : 'bg-slate-50'
                      }`}
                      style={{ width, height: ROW_H }}
                      onPointerDown={(e) => {
                        // Mouse left-drag on empty space pans the timeline (2D);
                        // touch/trackpad pan natively; reservation presses are
                        // handled by the block itself.
                        if ((e.target as HTMLElement).closest('[data-reservation]')) return;
                        if (e.pointerType !== 'mouse' || e.button !== 0) return;
                        beginPan(e.clientX, e.clientY);
                      }}
                      onDoubleClick={(e) => {
                        // Ignore double-clicks that land on an existing block.
                        if ((e.target as HTMLElement).closest('[data-reservation]')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const abs = snap(rangeStart + ((e.clientX - rect.left) / pxPerHour) * 60);
                        // Allow creating anywhere on the axis (open or closed hours).
                        const clamped = Math.max(rangeStart, Math.min(abs, Math.min(rangeEnd, maxAbs) - 30));
                        const { date: dDate, baseAbs } = absToParts(clamped);
                        onCreateAt(t.id, dDate, clamped - baseAbs);
                      }}
                      title="Double-click an empty slot to add a reservation"
                    >
                      {/* white open-hours bands over the gray (closed) base */}
                      {openBands.map((b) => (
                        <div
                          key={b.from}
                          className="absolute top-0 bottom-0 bg-white pointer-events-none"
                          style={{ left: minToX(b.from), width: minToX(b.to) - minToX(b.from) }}
                        />
                      ))}
                      {/* drop-target tint — drawn AFTER the white bands so the
                          move-highlight is visible across white open hours too,
                          not just the gray/closed areas. Green = valid, red =
                          would overlap. */}
                      {isDropTarget && (
                        <div
                          className={`absolute inset-0 pointer-events-none ${
                            dropOk ? 'bg-emerald-300/30' : 'bg-red-300/30'
                          }`}
                        />
                      )}
                      {/* dim the elapsed part of the day (past = subtly gray) */}
                      {nowAbs !== null && nowAbs > rangeStart && (
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-slate-900/[0.05] pointer-events-none"
                          style={{ width: minToX(Math.min(nowAbs, rangeEnd)) }}
                        />
                      )}
                      {/* day boundary lines */}
                      {dayMarkers.map((m, i) =>
                        i > 0 ? (
                          <div
                            key={m.date}
                            className="absolute top-0 bottom-0 border-l-2 border-slate-300 pointer-events-none"
                            style={{ left: minToX(m.from) }}
                          />
                        ) : null,
                      )}
                      {/* gridlines */}
                      {ticks.map(({ min, isHour }) => (
                        <div
                          key={min}
                          className={`absolute top-0 bottom-0 border-l pointer-events-none ${
                            isHour ? 'border-slate-200' : 'border-dashed border-slate-100'
                          }`}
                          style={{ left: minToX(min) }}
                        />
                      ))}

                      {/* blocked bands — one per day in the window */}
                      {days.flatMap((d) =>
                        blocksForTable(t.id, d.date).map((b) => {
                          const base = d.index * MIN_PER_DAY;
                          const x = minToX(base + toMin(b.startTime));
                          const w = minToX(base + toMin(b.endTime)) - x;
                          return (
                            <div
                              key={`${d.date}-${b.id}`}
                              className="absolute top-1.5 bottom-1.5 bg-orange-400/80 border border-orange-500 rounded text-[10px] text-white px-1.5 flex items-center overflow-hidden pointer-events-none"
                              style={{ left: x, width: Math.max(w, 4) }}
                              title={`Blocked: ${b.reason}`}
                            >
                              {w > 30 && b.reason}
                            </div>
                          );
                        }),
                      )}

                      {/* reservation blocks */}
                      {rows.map((r) => {
                        const abs = resAbs(r);
                        const isActive = preview?.id === r.id;
                        const override = overrides[r.id];
                        const start = isActive ? preview!.start : override ? override.start : abs.start;
                        const end   = isActive ? preview!.end   : override ? override.end   : abs.end;
                        const x = minToX(start);
                        const w = minToX(end) - x;
                        const isDragging = preview?.id === r.id || !!overrides[r.id];
                        const isPast = now >= resEpochRange(r).end;
                        const visual = reservationVisual(r, now);
                        const wide = Math.max(w, 36);
                        // Bell (confirm) shows while a booking is PENDING — e.g.
                        // right after it's moved — and clears it to CONFIRMED.
                        const needsConfirm = r.status === 'PENDING';
                        // Arrival tick shows once the booking's time has come
                        // (now ≥ start) and it isn't already seated/done/cancelled
                        // — pressing it seats the guest (→ yellow).
                        const canArrive =
                          now >= resEpochRange(r).start &&
                          !['SEATED', 'COMPLETED', 'CANCELLED'].includes(r.status);
                        return (
                          <div
                            key={r.id}
                            data-reservation
                            onPointerDown={(e) => {
                              if (e.button !== 0) return; // left-button only; right opens the menu
                              e.preventDefault();
                              dragRef.current = {
                                id: r.id,
                                mode: 'move',
                                startX: e.clientX,
                                origStart: abs.start,
                                origEnd: abs.end,
                                origTableId: r.tableId,
                              };
                            }}
                            onClick={() => !dragRef.current && !overrides[r.id] && onEdit(r)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setCtxMenu({ x: e.clientX, y: e.clientY, res: r });
                            }}
                            className={`absolute rounded-md px-2 py-1 text-xs cursor-grab active:cursor-grabbing overflow-hidden select-none transition-[box-shadow,opacity] duration-150 ${VISUAL_CLASS[visual]} ${
                              isActive
                                ? `shadow-xl z-20 opacity-90 ring-2 ${preview!.valid ? 'ring-emerald-400' : 'ring-red-500'}`
                                : isDragging
                                  ? 'shadow-xl ring-2 ring-indigo-300 z-20'
                                  : isPast
                                    ? 'shadow-sm opacity-80 hover:opacity-100 hover:shadow-lg'
                                    : 'shadow-sm hover:shadow-lg'
                            }`}
                            style={{
                              // Position via transform (not `left`) so moving the
                              // block during a drag is a compositor-only change —
                              // no per-frame layout — which keeps it smooth. While
                              // actively dragging it lifts slightly (scale 1.02).
                              left: 0,
                              transform: `translateX(${x}px)${isActive ? ' scale(1.02)' : ''}`,
                              willChange: isDragging ? 'transform' : undefined,
                              width: wide,
                              top: 4,
                              bottom: 4,
                              touchAction: 'none',
                              // While this block is the one being dragged, let
                              // pointer events fall through to the row below so
                              // the drop-target row is detected correctly.
                              pointerEvents: isActive ? 'none' : undefined,
                            }}
                          >
                            <span className="font-semibold truncate flex items-center gap-1 leading-tight">
                              <ChannelIcon channel={r.channel} size={11} className="shrink-0 opacity-90" />
                              <span className="truncate">{r.name} {r.surname}</span>
                            </span>
                            <span className="opacity-80 leading-tight block text-[10px]">
                              {/* snap the readout to 15-min steps so dragging shows
                                  clean times (…:00/:15/:30/:45), not raw minutes.
                                  While dragging/resizing, show the live duration. */}
                              {minToLabel(snap(start) % MIN_PER_DAY)}–{minToLabel(snap(end) % MIN_PER_DAY)}
                              {' · '}
                              {isDragging ? fmtDuration(snap(end) - snap(start)) : `${r.guests}p`}
                            </span>
                            {/* arrival tick — appears at the booking's start time;
                                press to mark the guest as arrived (seated/yellow) */}
                            {canArrive && wide > 60 && (
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArrive(r);
                                }}
                                title="Mark guest as arrived"
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-emerald-600 hover:bg-white flex items-center justify-center shadow ring-1 ring-emerald-500/30"
                              >
                                <FiCheck size={13} />
                              </button>
                            )}
                            {/* confirm bell (pending state) — press once you've
                                notified the customer to move it to CONFIRMED */}
                            {needsConfirm && wide > 60 && (
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConfirm(r);
                                }}
                                title="Pending — notify the customer, then click to confirm"
                                className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/90 text-blue-600 hover:bg-white flex items-center justify-center shadow ring-1 ring-blue-500/30"
                              >
                                <FiBell size={12} />
                              </button>
                            )}
                            {/* resize handles — both edges (left = start, right
                                = end). Hidden on cancelled bookings. */}
                            {r.status !== 'CANCELLED' && wide > 28 && (
                              <>
                                <span
                                  onPointerDown={(e) => {
                                    if (e.button !== 0) return; // right-click → context menu
                                    e.stopPropagation();
                                    e.preventDefault();
                                    dragRef.current = {
                                      id: r.id,
                                      mode: 'resize',
                                      edge: 'start',
                                      startX: e.clientX,
                                      origStart: abs.start,
                                      origEnd: abs.end,
                                      origTableId: r.tableId,
                                    };
                                  }}
                                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center"
                                  style={{ touchAction: 'none' }}
                                >
                                  <span className="w-0.5 h-4 bg-current opacity-40 rounded-full" />
                                </span>
                                <span
                                  onPointerDown={(e) => {
                                    if (e.button !== 0) return; // right-click → context menu
                                    e.stopPropagation();
                                    e.preventDefault();
                                    dragRef.current = {
                                      id: r.id,
                                      mode: 'resize',
                                      edge: 'end',
                                      startX: e.clientX,
                                      origStart: abs.start,
                                      origEnd: abs.end,
                                      origTableId: r.tableId,
                                    };
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center"
                                  style={{ touchAction: 'none' }}
                                >
                                  <span className="w-0.5 h-4 bg-current opacity-40 rounded-full" />
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {/* one continuous now-line across the whole body, at z-[5] so it sits
              above table-row content but BELOW the opaque sticky label cells
              (z-10) and the zone-header strips (z-10), which clip it inside the
              label column and let it pass softly behind the zone headers. */}
          {showNow && nowAbs !== null && nowAbs >= rangeStart && nowAbs <= rangeEnd && tables.length > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-[5]"
              style={{ left: LABEL_W + minToX(nowAbs) }}
            />
          )}
          {tables.length === 0 && (
            <p className="px-4 py-8 text-center text-slate-400 text-sm">
              No tables configured yet. Add them in the Floor Plan section.
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
    {ctxMenu && (
      <>
        {/* click-away layer */}
        <div
          className="fixed inset-0 z-40"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        />
        <div
          className="fixed z-50 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-sm"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 200),
            top: Math.min(ctxMenu.y, window.innerHeight - 180),
          }}
        >
          <button
            onClick={() => { onEdit(ctxMenu.res); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
          >
            <FiEdit2 size={14} /> Edit reservation
          </button>
          {!['SEATED', 'COMPLETED', 'CANCELLED'].includes(ctxMenu.res.status) && (
            <button
              onClick={() => { onArrive(ctxMenu.res); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
            >
              <FiUserCheck size={14} /> Mark seated
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(ctxMenu.res.status) && (
            <button
              onClick={() => { onComplete(ctxMenu.res); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
            >
              <FiCheckCircle size={14} /> Mark completed
            </button>
          )}
          {ctxMenu.res.status !== 'CANCELLED' && (
            <button
              onClick={() => { onCancel(ctxMenu.res); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-red-600"
            >
              <FiXCircle size={14} /> Cancel reservation
            </button>
          )}
        </div>
      </>
    )}
    </>
  );
}

function DayList({
  reservations,
  tableLabelById,
  onEdit,
}: {
  reservations: Reservation[];
  tableLabelById: (id: string | null) => string;
  onEdit: (r: Reservation) => void;
}) {
  const now = useNow();
  const sorted = [...reservations].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {sorted.length === 0 && (
        <p className="px-4 py-8 text-center text-slate-400 text-sm">No reservations for this day.</p>
      )}
      {sorted.map((r) => {
        const visual = reservationVisual(r, now);
        return (
          <button
            key={r.id}
            onClick={() => onEdit(r)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
          >
            <div className="flex items-center gap-4">
              {/* status dot mirrors the timeline colour */}
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${VISUAL_DOT[visual]}`} title={visual} />
              <span className="text-sm font-mono text-slate-500 w-24">
                {r.startTime}–{r.endTime}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <ChannelIcon channel={r.channel} size={13} className={channelMeta(r.channel).className} />
                  {r.name} {r.surname}
                </p>
                <p className="text-xs text-slate-500">
                  {tableLabelById(r.tableId)} · {r.guests} guests
                  {r.occasion ? ` · ${r.occasion}` : ''}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400">{r.source}</span>
          </button>
        );
      })}
    </div>
  );
}

function WeekView({ startDate }: { startDate: string }) {
  const [counts, setCounts] = useState<{ date: string; count: number; guests: number }[]>([]);
  useEffect(() => {
    let active = true;
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    Promise.all(days.map((d) => api.listReservations(d).then((rs) => ({ date: d, rs })))).then(
      (results) => {
        if (!active) return;
        setCounts(
          results.map((r) => ({
            date: r.date,
            count: r.rs.length,
            guests: r.rs.reduce((s, x) => s + x.guests, 0),
          })),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [startDate]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {counts.map((c) => (
        <div key={c.date} className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">
            {new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{c.count}</p>
          <p className="text-xs text-slate-500">reservations · {c.guests} guests</p>
        </div>
      ))}
    </div>
  );
}
