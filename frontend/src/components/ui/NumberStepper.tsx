'use client';

import { useCallback, useRef, useEffect } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function NumberStepper({ value, onChange, min = 1, max = 9999, step = 1 }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const stopRepeat = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const startRepeat = (delta: number) => {
    onChange(clamp(value + delta));
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        valueRef.current = clamp(valueRef.current + delta);
        onChange(valueRef.current);
      }, 75);
    }, 400);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className="ns-wrap">
      <button
        type="button"
        className={`ns-btn ns-btn-left${atMin ? ' ns-disabled' : ''}`}
        disabled={atMin}
        onMouseDown={() => startRepeat(-step)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        tabIndex={-1}
        aria-label="Decrease"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <input
        type="text"
        inputMode="numeric"
        className="ns-value"
        value={value}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          if (raw === '') return;
          onChange(clamp(parseInt(raw)));
        }}
        onBlur={() => onChange(clamp(value))}
      />

      <button
        type="button"
        className={`ns-btn ns-btn-right${atMax ? ' ns-disabled' : ''}`}
        disabled={atMax}
        onMouseDown={() => startRepeat(step)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        tabIndex={-1}
        aria-label="Increase"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
