'use client';

import { format } from 'date-fns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTallyUi } from '@/components/tally/TallyUiContext';

export function TallyPeriodOverlay() {
  const { periodOpen, closePeriod } = useTallyUi();

  const label = periodOpen === 'date' ? 'Current date' : 'Reporting period';

  return (
    <Dialog
      open={periodOpen != null}
      onOpenChange={(o) => {
        if (!o) closePeriod();
      }}
    >
      <DialogContent className="max-w-sm rounded-none border border-[var(--tally-border)] bg-[var(--tally-input-bg)] p-0 shadow-none [&>button]:text-[var(--tally-text)]">
        <DialogTitle className="border-b border-[var(--tally-border)] bg-[var(--tally-green)] px-2 py-1 text-left text-[13px] text-white">
          {label}
        </DialogTitle>
        <div className="p-3 text-[13px] text-[var(--tally-text)]">
          {periodOpen === 'date' ? (
            <p className="tabular-nums">{format(new Date(), 'd-MMM-yyyy')}</p>
          ) : (
            <p className="text-[var(--tally-text-muted)]">
              Full period picker can tie to financial_years (Phase A).
            </p>
          )}
          <p className="mt-2 text-[11px] text-[var(--tally-text-muted)]">Esc to close</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
