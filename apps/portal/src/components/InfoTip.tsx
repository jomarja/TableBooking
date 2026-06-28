import { useId } from 'react';
import { FiInfo } from 'react-icons/fi';

/**
 * Small info icon with an accessible hover + keyboard-focus tooltip.
 * Renders a real styled popover (not the unreliable native `title`, which is
 * slow, hover-only and never appears on focus). Shows on mouse hover AND
 * keyboard focus, wraps long text, and escapes its container via absolute
 * positioning + a high z-index so it is never clipped.
 */
export function InfoTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        aria-describedby={id}
        className="inline-flex items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-help"
      >
        <FiInfo size={13} />
      </button>

      {/* Popover — hidden by default, revealed on hover OR keyboard focus. */}
      <span
        id={id}
        role="tooltip"
        className={
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 ' +
          'rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal leading-relaxed text-white ' +
          'whitespace-normal text-left normal-case shadow-lg ' +
          'opacity-0 invisible translate-y-1 transition-all duration-150 ease-out ' +
          'group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 ' +
          'group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0'
        }
      >
        {text}
        {/* caret */}
        <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800" />
      </span>
    </span>
  );
}
