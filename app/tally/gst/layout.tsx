'use client';

import { GstPeriodProvider } from '@/app/tally/gst/gst-period-context';
import { TallyGstPeriodOverlay } from '@/components/tally/TallyGstPeriodOverlay';

export default function GstLayout({ children }: { children: React.ReactNode }) {
  return (
    <GstPeriodProvider>
      {children}
      <TallyGstPeriodOverlay />
    </GstPeriodProvider>
  );
}
