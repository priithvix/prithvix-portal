'use client';

import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTallyUi } from '@/components/tally/TallyUiContext';

const REPORTS: { label: string; href: string }[] = [
  { label: 'Day Book', href: '/tally/day-book' },
  { label: 'Balance Sheet', href: '/tally/balance-sheet' },
  { label: 'Profit & Loss A/c', href: '/tally/profit-loss' },
  { label: 'Trial Balance', href: '/tally/trial-balance' },
  { label: 'Stock Summary', href: '/tally/stock-summary' },
  { label: 'Outstanding', href: '/tally/outstanding' },
  { label: 'Ratio Analysis', href: '/tally/ratio-analysis' },
  { label: 'GST Reports', href: '/tally/gst' },
  { label: 'Chart of Accounts', href: '/tally/coa' },
];

const VOUCHERS: { label: string; href: string }[] = [
  { label: 'New Sales Voucher (F8)', href: '/tally/voucher/new?type=SAL' },
  { label: 'New Purchase (F9)', href: '/tally/voucher/new?type=PUR' },
  { label: 'Payment (F5)', href: '/tally/voucher/new?type=PMT' },
  { label: 'Receipt (F6)', href: '/tally/voucher/new?type=RCT' },
  { label: 'Journal (F7)', href: '/tally/voucher/new?type=JNL' },
  { label: 'Contra (F4)', href: '/tally/voucher/new?type=CNT' },
];

const MASTERS: { label: string; href: string }[] = [
  { label: 'Masters Create', href: '/tally/masters/create' },
  { label: 'Masters Alter', href: '/tally/masters/alter' },
];

export function TallyGoToDialog() {
  const router = useRouter();
  const { goToOpen, setGoToOpen } = useTallyUi();

  const navigate = (href: string) => {
    setGoToOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={goToOpen} onOpenChange={setGoToOpen}>
      <DialogContent
        className="max-w-lg rounded-none border-[3px] border-[var(--tally-border)] bg-[var(--tally-bg)] p-0 shadow-none [&>button]:text-[var(--tally-text)]"
      >
        <DialogTitle className="border-b border-[var(--tally-border)] bg-[var(--tally-yellow)] px-2 py-1 text-left text-[13px] font-semibold text-[var(--tally-yellow-text)]">
          Go To
        </DialogTitle>
        <Command className="rounded-none bg-[var(--tally-input-bg)]">
          <Command.Input
            placeholder="Type a report or master…"
            className="tally-input mx-2 my-2 w-[calc(100%-1rem)] border-[var(--tally-border)]"
          />
          <Command.List className="max-h-72 overflow-auto px-1 pb-2">
            <Command.Empty className="px-2 py-2 text-[12px] text-[var(--tally-text-muted)]">
              No matches.
            </Command.Empty>
            <Command.Group
              heading="Reports"
              className="px-1 text-[10px] font-semibold uppercase text-[var(--tally-text-muted)]"
            >
              {REPORTS.map((r) => (
                <Command.Item
                  key={r.href}
                  value={r.label}
                  onSelect={() => navigate(r.href)}
                  className="cursor-pointer px-2 py-1 text-[13px] aria-selected:bg-[var(--tally-selected-bg)] aria-selected:text-[var(--tally-selected-text)]"
                >
                  {r.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group
              heading="Vouchers"
              className="px-1 text-[10px] font-semibold uppercase text-[var(--tally-text-muted)]"
            >
              {VOUCHERS.map((r) => (
                <Command.Item
                  key={r.href}
                  value={r.label}
                  onSelect={() => navigate(r.href)}
                  className="cursor-pointer px-2 py-1 text-[13px] aria-selected:bg-[var(--tally-selected-bg)] aria-selected:text-[var(--tally-selected-text)]"
                >
                  {r.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group
              heading="Masters"
              className="px-1 text-[10px] font-semibold uppercase text-[var(--tally-text-muted)]"
            >
              {MASTERS.map((r) => (
                <Command.Item
                  key={r.href}
                  value={r.label}
                  onSelect={() => navigate(r.href)}
                  className="cursor-pointer px-2 py-1 text-[13px] aria-selected:bg-[var(--tally-selected-bg)] aria-selected:text-[var(--tally-selected-text)]"
                >
                  {r.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
