// ============================================================================
// File: src/components/admin/animated-number.tsx
// Purpose: Smoothly animates a number from its previous value to a new value
//          using requestAnimationFrame. Used on dashboard stat cards so the
//          numbers "count up" when the page loads or when data refreshes.
//          Handles both numeric values and pre-formatted strings (in which
//          case no animation is performed — the string is displayed as-is).
// ============================================================================

"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number | string;
  duration?: number; // milliseconds, default 600
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 600,
  format,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // If value is a string (e.g. "Rs. 11273.00"), display it directly without
  // animation — the string is already formatted by the caller.
  const numericValue = typeof value === "number" ? value : Number(value);
  const isNumeric = typeof value === "number" || (!isNaN(numericValue) && isFinite(numericValue));

  useEffect(() => {
    if (!isNumeric) return;

    const from = fromRef.current;
    const to = numericValue;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [numericValue, duration, isNumeric]);

  // If the value is a non-numeric string, just display it directly
  if (!isNumeric) {
    return <span className={className}>{String(value)}</span>;
  }

  const formatted = format ? format(display) : Math.round(display).toLocaleString("en-IN");
  return <span className={className}>{formatted}</span>;
}
