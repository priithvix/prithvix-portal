'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export interface TallyButtonSpec {
  label: string;
  shortcut: string;
  onClick?: () => void;
}

const TallyButtonBarSetterContext = createContext<((b: TallyButtonSpec[]) => void) | null>(null);
const TallyButtonBarButtonsContext = createContext<TallyButtonSpec[]>([]);

export function TallyButtonBarProvider({ children }: { children: ReactNode }) {
  const [buttons, setButtonsState] = useState<TallyButtonSpec[]>([]);
  const setButtons = useCallback((b: TallyButtonSpec[]) => {
    setButtonsState(b);
  }, []);

  return (
    <TallyButtonBarSetterContext.Provider value={setButtons}>
      <TallyButtonBarButtonsContext.Provider value={buttons}>{children}</TallyButtonBarButtonsContext.Provider>
    </TallyButtonBarSetterContext.Provider>
  );
}

/** Stable setter — subscribing components do not re-render when the visible button list updates. */
export function useTallySetButtons() {
  const fn = useContext(TallyButtonBarSetterContext);
  if (!fn) throw new Error('useTallySetButtons must be used within TallyButtonBarProvider');
  return fn;
}

/** Right-side button bar only — re-renders when buttons change. */
export function useTallyButtons() {
  return useContext(TallyButtonBarButtonsContext);
}
