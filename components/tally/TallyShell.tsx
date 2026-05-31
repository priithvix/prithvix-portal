'use client';

import { useEffect } from 'react';
import { TallyTopMenu } from '@/components/tally/TallyTopMenu';
import { TallyTabBar } from '@/components/tally/TallyTabBar';
import { TallyRightButtonBar } from '@/components/tally/TallyRightButtonBar';
import { TallyStatusBar } from '@/components/tally/TallyStatusBar';
import { TallyKeyboardProvider } from '@/components/tally/TallyKeyboardProvider';
import { TallyUiProvider } from '@/components/tally/TallyUiContext';
import { TallyButtonBarProvider } from '@/components/tally/TallyButtonBarContext';
import { TallyCalculator } from '@/components/tally/TallyCalculator';
import { TallyGoToDialog } from '@/components/tally/TallyGoToDialog';
import { TallyPeriodOverlay } from '@/components/tally/TallyPeriodOverlay';

export function TallyShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('tally-route-active');
    return () => {
      document.body.classList.remove('tally-route-active');
    };
  }, []);

  return (
    <TallyUiProvider>
      <TallyButtonBarProvider>
        <TallyKeyboardProvider>
          <style>{`
            [data-sonner-toaster],
            [data-sonner-toast],
            .sonner-toaster,
            .sonner-toast,
            ol[data-sonner-toaster] {
              display: none !important;
            }
          `}</style>
          <div className="flex min-h-screen flex-col">
            <TallyTopMenu />
            <TallyTabBar />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main className="min-h-0 flex-1 overflow-auto p-0">{children}</main>
              <TallyRightButtonBar />
            </div>
            <TallyStatusBar />
          </div>
          <TallyCalculator />
          <TallyGoToDialog />
          <TallyPeriodOverlay />
        </TallyKeyboardProvider>
      </TallyButtonBarProvider>
    </TallyUiProvider>
  );
}
