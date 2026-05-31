'use client';

import { useEffect } from 'react';
import { TallyPlaceholderScreen } from '@/components/tally/TallyPlaceholderScreen';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';

export default function GSTTabPage() {
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'GSTR-1', shortcut: 'Alt+G1' },
      { label: 'GSTR-3B', shortcut: 'Alt+G3' },
      { label: 'Export', shortcut: 'Alt+E' },
      { label: 'Period', shortcut: 'F2' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  return (
    <TallyPlaceholderScreen
      title="GST"
      subtitle="Returns, E-Invoice, E-Way Bill, Reconciliation"
      features={[
        { hotkey: '1', label: 'GSTR-1 (Outward Supplies)', href: '/tally/gst/gstr1', status: 'live' },
        { hotkey: '3', label: 'GSTR-3B (Monthly Return)', href: '/tally/gst/gstr3b', status: 'live' },
        { hotkey: '2', label: 'GSTR-2B Reconciliation', href: '/tally/gst/gstr2b', status: 'live' },
        {
          hotkey: 'E',
          label: 'E-Invoice (IRN)',
          href: '/tally/gst/einvoice',
          status: 'live',
          note: 'Generates NIC-format JSON for portal upload',
        },
        {
          hotkey: 'W',
          label: 'E-Way Bill',
          href: '/tally/gst/ewaybill',
          status: 'live',
          note: 'Generates NIC-format JSON for portal upload',
        },
        { hotkey: 'H', label: 'HSN-wise Summary', href: '/tally/gst/hsn', status: 'live' },
        { hotkey: 'R', label: 'GST Audit Report', href: '/tally/gst/audit', status: 'live' },
        { hotkey: '9', label: 'GSTR-9 (Annual Return)', href: '/tally/gst/gstr9', status: 'live' },
      ]}
    />
  );
}
