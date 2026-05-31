'use client';

import { useCallback, useState } from 'react';
import { useTallyUi } from '@/components/tally/TallyUiContext';

function safeEvaluateArithmetic(expr: string): number | null {
  const trimmed = expr.replace(/\s+/g, '');
  if (!trimmed || !/^[0-9+\-*/().]+$/.test(trimmed)) return null;
  try {
    const fn = new Function(`return (${trimmed})`);
    const n = fn();
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function TallyCalculator() {
  const { calculatorOpen, setCalculatorOpen } = useTallyUi();
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const evaluate = useCallback(() => {
    setResult(safeEvaluateArithmetic(expr));
  }, [expr]);

  if (!calculatorOpen) return null;

  return (
    <div
      className="fixed bottom-8 left-0 right-36 z-[300] flex items-center gap-2 border-t-2 border-[var(--tally-border)] bg-[#F5F5F5] px-3 py-1.5 text-[13px] text-[#222222]"
      role="region"
      aria-label="Calculator"
    >
      <span className="font-bold">Calc:</span>
      <input
        autoFocus
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') evaluate();
          if (e.key === 'Escape') setCalculatorOpen(false);
        }}
        className="tally-input min-w-0 flex-1"
      />
      <span className="font-mono font-bold tabular-nums">
        = {result != null ? result.toFixed(2) : '—'}
      </span>
      <span className="text-[11px] text-[var(--tally-text-muted)]">Ctrl+N to close</span>
    </div>
  );
}
