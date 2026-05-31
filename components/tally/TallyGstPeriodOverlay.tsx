'use client';

import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { TallyPeriodSelector } from '@/components/tally/TallyPeriodSelector';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** GST-specific F2 period overlay (capture phase so it wins over global Tally F2). */
export function TallyGstPeriodOverlay() {
  const pathname = usePathname();
  const isGst = pathname?.startsWith('/tally/gst') ?? false;
  const {
    selectedPeriod,
    financialYear,
    periods,
    setSelectedPeriod,
    periodSelectorOpen,
    openPeriodSelector,
    closePeriodSelector,
  } = useGstPeriodContext();

  useEffect(() => {
    if (!isGst) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openPeriodSelector();
      }
    };
    window.addEventListener('keydown', fn, true);
    return () => window.removeEventListener('keydown', fn, true);
  }, [isGst, openPeriodSelector]);

  if (!isGst) return null;

  return (
    <TallyPeriodSelector
      open={periodSelectorOpen}
      onClose={closePeriodSelector}
      selectedPeriod={selectedPeriod}
      financialYear={financialYear}
      periods={periods}
      onChange={setSelectedPeriod}
    />
  );
}
