'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type PeriodMode = 'date' | 'range';

interface TallyUiContextValue {
  calculatorOpen: boolean;
  setCalculatorOpen: (v: boolean) => void;
  toggleCalculator: () => void;
  goToOpen: boolean;
  setGoToOpen: (v: boolean) => void;
  periodOpen: PeriodMode | null;
  openPeriod: (mode: PeriodMode) => void;
  closePeriod: () => void;
}

const TallyUiContext = createContext<TallyUiContextValue | null>(null);

export function TallyUiProvider({ children }: { children: React.ReactNode }) {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState<PeriodMode | null>(null);

  const toggleCalculator = useCallback(() => {
    setCalculatorOpen((o) => !o);
  }, []);

  const openPeriod = useCallback((mode: PeriodMode) => {
    setPeriodOpen(mode);
  }, []);

  const closePeriod = useCallback(() => setPeriodOpen(null), []);

  const value = useMemo(
    () => ({
      calculatorOpen,
      setCalculatorOpen,
      toggleCalculator,
      goToOpen,
      setGoToOpen,
      periodOpen,
      openPeriod,
      closePeriod,
    }),
    [
      calculatorOpen,
      toggleCalculator,
      goToOpen,
      periodOpen,
      openPeriod,
      closePeriod,
    ]
  );

  return <TallyUiContext.Provider value={value}>{children}</TallyUiContext.Provider>;
}

export function useTallyUi() {
  const ctx = useContext(TallyUiContext);
  if (!ctx) throw new Error('useTallyUi must be used within TallyUiProvider');
  return ctx;
}
