import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Accessible, reliable dropdown that replaces the native <select>.
 * The menu is rendered in a portal with fixed positioning, so it never gets
 * clipped by modals/overflow containers and never "lags" or vanishes on
 * re-render. Supports mouse + full keyboard (↑/↓/Enter/Esc/Home/End),
 * click-outside, and closes on scroll/resize.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  disabled,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [rect, setRect] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const labelId = useId();

  const selected = options.find((o) => o.value === value);

  const position = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 240 && r.top > spaceBelow;
    // The menu grows to fit its widest option (up to maxW) — keep it on-screen.
    const maxW = Math.min(window.innerWidth * 0.9, 384);
    setRect({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - maxW)),
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    });
  };

  const openMenu = () => {
    if (disabled) return;
    position();
    const i = options.findIndex((o) => o.value === value);
    setActiveIndex(i >= 0 ? i : 0);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  useLayoutEffect(() => {
    if (open) position();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (listRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onScrollResize = () => close();
    document.addEventListener('mousedown', onDocPointer);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      (listRef.current.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [activeIndex, open]);

  const choose = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => {
          let n = i;
          do {
            n = Math.min(options.length - 1, n + 1);
          } while (options[n]?.disabled && n < options.length - 1);
          return n;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => {
          let n = i;
          do {
            n = Math.max(0, n - 1);
          } while (options[n]?.disabled && n > 0);
          return n;
        });
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (options[activeIndex]) choose(options[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-sm text-slate-700 transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? 'border-indigo-400 ring-2 ring-indigo-500' : 'border-slate-200'
        } ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <FiChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={labelId}
            className="fixed z-[100] max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl focus:outline-none"
            style={{
              left: rect.left,
              minWidth: rect.width,
              width: 'max-content',
              maxWidth: 'min(90vw, 24rem)',
              top: rect.top,
              bottom: rect.bottom,
            }}
          >
            {options.map((opt, i) => {
              const isSel = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={opt.disabled || undefined}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(opt)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                    opt.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : `cursor-pointer ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`
                  }`}
                >
                  <span className="whitespace-normal">{opt.label}</span>
                  {isSel && <FiCheck size={15} className="shrink-0 text-indigo-600" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
