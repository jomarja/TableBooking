import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

/**
 * Accessible, reliable dropdown that replaces the native <select>.
 * Rendered in a portal with fixed positioning so it never gets clipped by
 * cards/modals and never lags or vanishes on re-render. Full keyboard support
 * (arrows / Enter / Esc / Home / End), click-outside, closes on scroll/resize.
 *
 * options: [{ value, label, disabled? }]
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  disabled = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [rect, setRect] = useState(null);
  const labelId = useId();

  const selected = options.find((o) => o.value === value);

  const position = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 240 && r.top > spaceBelow;
    setRect({
      left: r.left,
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
    const onDocPointer = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
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
      listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const choose = (opt) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
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
        className={`inline-flex items-center justify-between gap-2 px-4 py-3 min-h-[48px] rounded-lg border bg-white text-sm text-gray-900 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? 'border-emerald-500 ring-2 ring-emerald-500' : 'border-gray-300'
        } ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <FiChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={labelId}
            className="fixed z-[100] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl focus:outline-none"
            style={{
              left: rect.left,
              width: rect.width,
              minWidth: rect.width,
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
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm ${
                    opt.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : `cursor-pointer ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSel && <FiCheck size={15} className="shrink-0 text-emerald-600" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
