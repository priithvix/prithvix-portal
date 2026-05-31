'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  currentReturnPeriod,
  financialYearLabelFromPeriod,
  periodsInFinancialYear,
} from '@/lib/gst/period-utils';

type GstPeriodContextValue = {
  selectedPeriod: string;
  financialYear: string;
  periods: string[];
  setSelectedPeriod: (p: string) => void;
  periodSelectorOpen: boolean;
  openPeriodSelector: () => void;
  closePeriodSelector: () => void;
};

const GstPeriodContext = createContext<GstPeriodContextValue | null>(null);

export function GstPeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriod, setSelectedPeriodState] = useState(() => currentReturnPeriod());
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);

  const financialYear = useMemo(
    () => financialYearLabelFromPeriod(selectedPeriod),
    [selectedPeriod]
  );

  const periods = useMemo(() => periodsInFinancialYear(financialYear), [financialYear]);

  const setSelectedPeriod = useCallback((p: string) => {
    setSelectedPeriodState(p);
    setPeriodSelectorOpen(false);
  }, []);

  const openPeriodSelector = useCallback(() => setPeriodSelectorOpen(true), []);
  const closePeriodSelector = useCallback(() => setPeriodSelectorOpen(false), []);

  const value = useMemo(
    () => ({
      selectedPeriod,
      financialYear,
      periods,
      setSelectedPeriod,
      periodSelectorOpen,
      openPeriodSelector,
      closePeriodSelector,
    }),
    [
      selectedPeriod,
      financialYear,
      periods,
      setSelectedPeriod,
      periodSelectorOpen,
      openPeriodSelector,
      closePeriodSelector,
    ]
  );

  return <GstPeriodContext.Provider value={value}>{children}</GstPeriodContext.Provider>;
}

export function useGstPeriodContext() {
  const ctx = useContext(GstPeriodContext);
  if (!ctx) throw new Error('useGstPeriodContext must be used within GstPeriodProvider');
  return ctx;
}
