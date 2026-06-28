import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  min?: string; // 'YYYY-MM-DD'
  max?: string;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s?: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Accessible, themed date picker — a trigger button that opens a calendar
 * popover (rendered in a portal so it's never clipped by modals). Dependency-
 * free; matches the portal's Select look. Emits 'YYYY-MM-DD'.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  className = '',
  ariaLabel,
  placeholder = 'Select date',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const minD = parse(min);
  const maxD = parse(max);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const disabled = (d: Date) => (minD ? d < minD : false) || (maxD ? d > maxD : false);

  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back up to the Sunday of the first week
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const position = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const POP_H = 340;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < POP_H && r.top > spaceBelow;
    setRect({
      left: Math.min(r.left, window.innerWidth - 300),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    });
  };

  const openMenu = () => {
    setView(selected ?? new Date());
    position();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (open) position();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScrollResize = () => setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  const pick = (d: Date) => {
    if (disabled(d)) return;
    onChange(toStr(d));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const label = selected
    ? selected.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          open ? 'border-indigo-400 ring-2 ring-indigo-500' : 'border-slate-200'
        } ${className}`}
      >
        <FiCalendar size={15} className="shrink-0 text-slate-400" />
        <span className={`truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Choose a date"
            className="fixed z-[100] w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            style={{ left: rect.left, top: rect.top, bottom: rect.bottom }}
          >
            {/* Header — year + month navigation */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear() - 1, v.getMonth(), 1))}
                  aria-label="Previous year"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FiChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FiChevronLeft size={18} />
                </button>
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FiChevronRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear() + 1, v.getMonth(), 1))}
                  aria-label="Next year"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FiChevronsRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {w}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === view.getMonth();
                const dis = disabled(d);
                const sel = sameDay(d, selected);
                const isToday = sameDay(d, today);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={dis}
                    onClick={() => pick(d)}
                    className={`h-9 rounded-lg text-sm flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      sel
                        ? 'bg-indigo-600 text-white font-semibold shadow'
                        : dis
                          ? 'text-slate-300 cursor-not-allowed'
                          : inMonth
                            ? `text-slate-700 hover:bg-indigo-50 ${isToday ? 'ring-1 ring-indigo-300 font-semibold text-indigo-700' : ''}`
                            : 'text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center justify-end border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => pick(today)}
                disabled={disabled(today)}
                className="text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
