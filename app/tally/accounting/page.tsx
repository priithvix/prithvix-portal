'use client';

import { useEffect } from 'react';
import { TallyPlaceholderScreen } from '@/components/tally/TallyPlaceholderScreen';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';

export default function AccountingTabPage() {
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Contra', shortcut: 'F4' },
      { label: 'Payment', shortcut: 'F5' },
      { label: 'Receipt', shortcut: 'F6' },
      { label: 'Journal', shortcut: 'F7' },
      { label: 'Sales', shortcut: 'F8' },
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  return (
    <TallyPlaceholderScreen
      title="Accounting"
      subtitle="Vouchers, Ledgers, Chart of Accounts, Day Book"
      features={[
        { hotkey: 'V', label: 'Vouchers', href: '/tally/vouchers', status: 'live' },
        { hotkey: 'D', label: 'Day Book', href: '/tally/day-book', status: 'live' },
        { hotkey: 'H', label: 'Chart of Accounts', href: '/tally/coa', status: 'live' },
        { hotkey: 'C', label: 'Create Ledger', href: '/tally/masters/create?type=ledger', status: 'live' },
        { hotkey: 'A', label: 'Alter Ledger', href: '/tally/masters/alter', status: 'live' },
        { hotkey: 'J', label: 'Journal Entry', href: '/tally/voucher/new?type=JNL', status: 'live' },
        { hotkey: 'S', label: 'Contra Entry', href: '/tally/voucher/new?type=CNT', status: 'live' },
      ]}
    />
  );
}
