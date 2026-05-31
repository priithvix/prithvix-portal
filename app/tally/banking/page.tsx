'use client';

import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { TallyPlaceholderScreen } from '@/components/tally/TallyPlaceholderScreen';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTallyUi } from '@/components/tally/TallyUiContext';

export default function BankingTabPage() {
  const router = useRouter();
  const setButtons = useTallySetButtons();
  const { openPeriod } = useTallyUi();

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => openPeriod('date') },
      { label: 'Reconcile', shortcut: 'Alt+R', onClick: () => router.push('/tally/bank-rec') },
      { label: 'PDC', shortcut: 'Alt+P', onClick: () => router.push('/tally/banking/pdc') },
      { label: 'Cheque', shortcut: 'Alt+C', onClick: () => router.push('/tally/banking/cheques') },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriod, router]);

  useHotkeys('alt+r', (e) => {
    e.preventDefault();
    router.push('/tally/bank-rec');
  });
  useHotkeys('alt+p', (e) => {
    e.preventDefault();
    router.push('/tally/banking/pdc');
  });
  useHotkeys('alt+c', (e) => {
    e.preventDefault();
    router.push('/tally/banking/cheques');
  });

  return (
    <TallyPlaceholderScreen
      title="Banking"
      subtitle="Bank Accounts, Cheque Register, Reconciliation, PDC"
      features={[
        { hotkey: 'R', label: 'Bank Reconciliation', href: '/tally/bank-rec', status: 'live' },
        { hotkey: 'C', label: 'Cheque Register', href: '/tally/banking/cheques', status: 'live' },
        { hotkey: 'P', label: 'Post-dated Cheques (PDC)', href: '/tally/banking/pdc', status: 'live' },
        { hotkey: 'S', label: 'Bank Statement Import', href: '/tally/banking/import', status: 'live' },
        { hotkey: 'B', label: 'Bank Book', href: '/tally/banking/bank-book', status: 'live' },
        { hotkey: 'O', label: 'Outstanding Payables', href: '/tally/banking/payables', status: 'live' },
        { hotkey: 'D', label: 'Outstanding Receivables', href: '/tally/banking/receivables', status: 'live' },
      ]}
    />
  );
}
