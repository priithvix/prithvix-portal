'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { periodToShortLabel } from '@/lib/gst/period-utils';

export interface TallyPeriodSelectorProps {
  open: boolean;
  onClose: () => void;
  selectedPeriod: string;
  financialYear: string;
  periods: string[];
  onChange: (period: string) => void;
}

/**
 * Tally-style GST period picker: pills for Apr–Mar of FY.
 * Arrow keys move highlight; Enter confirms.
 */
export function TallyPeriodSelector({
  open,
  onClose,
  selectedPeriod,
  financialYear,
  periods,
  onChange,
}: TallyPeriodSelectorProps) {
  const [highlight, setHighlight] = useState(() =>
    Math.max(
      0,
      periods.findIndex((p) => p === selectedPeriod)
    )
  );

  useEffect(() => {
    if (!open) return;
    const i = periods.findIndex((p) => p === selectedPeriod);
    setHighlight(i >= 0 ? i : 0);
  }, [open, selectedPeriod, periods]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, periods.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const p = periods[highlight];
        if (p) onChange(p);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [highlight, onChange, onClose, periods]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) containerRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-[720px] rounded-none border border-[#AAAAAA] bg-[#FFF8E7] p-0 shadow-none [&>button]:text-black">
        <div
          ref={containerRef}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="outline-none"
        >
        <DialogTitle
          className="border-b border-[#AAAAAA] px-2 py-1 text-left text-[13px] text-white"
          style={{ background: '#1B5E20' }}
        >
          Return period · FY {financialYear} (F2)
        </DialogTitle>
        <div className="px-3 py-2 text-[13px] text-black">
          <div className="mb-2 text-[11px] text-[#555555]">
            Period: <span className="font-semibold tabular-nums">{selectedPeriod}</span> — Arrow keys · Enter
            to confirm
          </div>
          <div className="flex flex-wrap gap-1">
            {periods.map((p, i) => {
              const sel = p === selectedPeriod;
              const hi = i === highlight;
              return (
                <button
                  key={p}
                  type="button"
                  className="min-w-[56px] px-2 py-[3px] text-[12px] tabular-nums outline-none"
                  style={{
                    border: '1px solid #AAAAAA',
                    background: sel ? '#1B5E20' : hi ? '#FFEB3B' : '#FFF8E7',
                    color: sel ? '#FFFFFF' : '#000000',
                  }}
                  onClick={() => onChange(p)}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {periodToShortLabel(p)}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
