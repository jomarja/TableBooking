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
 * A number input that's pleasant to type in: you can clear it and type freely
 * (the native `Number('') === 0` snap is avoided), valid numbers are emitted as
 * you go, and the value is clamped to min/max once on blur.
 */
export function NumberField({ value, onChange, min, max, step, className, placeholder, id }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

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
      inputMode="decimal"
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
        if (raw === '') return;
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
