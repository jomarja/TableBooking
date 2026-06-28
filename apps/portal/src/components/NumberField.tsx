import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  id?: string;
}

/**
 * A number input that's actually pleasant to type in.
 *
 * The native pattern `value={n} onChange={e => set(Number(e.target.value))}`
 * snaps the field to 0 the moment you clear it (because `Number('') === 0`),
 * which makes it impossible to retype a value. This keeps a local text buffer
 * so you can clear the field and type freely; it emits valid numbers as you go
 * and clamps to min/max once on blur.
 */
export function NumberField({ value, onChange, min, max, step, className, placeholder, id }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Reflect external changes only while not editing, so typing is never fought.
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  };

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      className={className}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === '') return; // allow an empty field while typing
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number(text);
        const final = text === '' || Number.isNaN(n) ? clamp(min ?? 0) : clamp(n);
        setText(String(final));
        onChange(final);
      }}
    />
  );
}
