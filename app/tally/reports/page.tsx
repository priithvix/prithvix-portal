'use client';

import { useEffect } from 'react';
import { TallyPlaceholderScreen } from '@/components/tally/TallyPlaceholderScreen';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';

export default function ReportsTabPage() {
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2' },
      { label: 'Print', shortcut: 'Alt+P' },
      { label: 'Export', shortcut: 'Alt+E' },
      { label: 'View', shortcut: 'Ctrl+H' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  return (
    <TallyPlaceholderScreen
      title="Reports & MIS"
      subtitle="Financial Statements, Registers, Analytics, Exports"
      features={[
        { hotkey: 'B', label: 'Balance Sheet', href: '/tally/balance-sheet', status: 'live' },
        { hotkey: 'P', label: 'Profit & Loss', href: '/tally/profit-loss', status: 'live' },
        { hotkey: 'T', label: 'Trial Balance', href: '/tally/trial-balance', status: 'live' },
        { hotkey: 'D', label: 'Day Book', href: '/tally/day-book', status: 'live' },
        { hotkey: 'S', label: 'Sales Register', href: '/tally/reports/sales', status: 'live' },
        { hotkey: 'U', label: 'Purchase Register', href: '/tally/reports/purchase', status: 'live' },
        { hotkey: 'L', label: 'Ledger Statement', href: '/tally/reports/ledger', status: 'live' },
        { hotkey: 'C', label: 'Cash Flow', href: '/tally/reports/cashflow', status: 'live' },
        { hotkey: 'R', label: 'Ratio Analysis', href: '/tally/ratio-analysis', status: 'live' },
        { hotkey: 'O', label: 'Outstanding Report', href: '/tally/outstanding', status: 'live' },
        { hotkey: 'K', label: 'Stock Summary', href: '/tally/stock-summary', status: 'live' },
        { hotkey: 'M', label: 'Comparative Report', href: '/tally/reports/compare', status: 'live' },
        { hotkey: 'X', label: 'Export All (PDF/Excel/Tally XML)', href: '/tally/reports/export', status: 'live' },
      ]}
    />
  );
}
