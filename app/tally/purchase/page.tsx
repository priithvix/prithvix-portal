'use client';

import { useEffect } from 'react';
import { TallyPlaceholderScreen } from '@/components/tally/TallyPlaceholderScreen';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';

export default function PurchaseTabPage() {
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'GRN', shortcut: 'Alt+G' },
      { label: 'Supplier', shortcut: 'Alt+S' },
      { label: 'Payables', shortcut: 'Alt+P' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  return (
    <TallyPlaceholderScreen
      title="Purchase & Stock"
      subtitle="Suppliers, Purchase Orders, GRN, Stock Management"
      features={[
        { hotkey: 'S', label: 'Supplier Master', href: '/tally/purchase/suppliers', status: 'live' },
        { hotkey: 'O', label: 'Purchase Order', href: '/tally/purchase/po', status: 'live' },
        { hotkey: 'G', label: 'Goods Receipt Note', href: '/tally/purchase/grn', status: 'live' },
        { hotkey: 'I', label: 'Purchase Invoice', href: '/tally/purchase/invoices', status: 'live' },
        { hotkey: 'D', label: 'Debit Note', href: '/tally/voucher/new?type=DBN', status: 'live' },
        { hotkey: 'T', label: 'Stock Summary', href: '/tally/stock-summary', status: 'live' },
        { hotkey: 'P', label: 'Supplier Ledger', href: '/tally/purchase/supplier-ledger', status: 'live' },
        { hotkey: 'A', label: 'Payables Dashboard', href: '/tally/purchase/payables', status: 'live' },
      ]}
    />
  );
}
