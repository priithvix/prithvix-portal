'use client';

import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type MenuEntry =
  | { kind: 'sub'; key: string; label: string; children: string[] }
  | {
      kind: 'actions';
      key: string;
      label: string;
      actions: { label: string; href?: string; onClick?: () => void }[];
    };

const MENU_ITEMS: MenuEntry[] = [
  { kind: 'sub', key: 'K', label: 'Company', children: ['Create', 'Alter', 'Select', 'Shut'] },
  { kind: 'sub', key: 'Y', label: 'Data', children: ['Backup', 'Restore', 'Export', 'Import'] },
  { kind: 'sub', key: 'Z', label: 'Exchange', children: ['Synchronization', 'Banking'] },
  { kind: 'sub', key: 'G', label: 'Go To', children: [] },
  { kind: 'sub', key: 'O', label: 'Import', children: ['Tally XML', 'Excel', 'GSTR-2B JSON'] },
  {
    kind: 'actions',
    key: 'E',
    label: 'Export',
    actions: [
      { label: 'Export Tally XML', href: '/tally/reports/export?format=xml' },
      { label: 'Export Excel Bundle', href: '/tally/reports/export?format=excel' },
      { label: 'Export PDF Bundle', href: '/tally/reports/export?format=pdf' },
      { label: 'JSON', href: '/tally/reports/export' },
    ],
  },
  { kind: 'sub', key: 'M', label: 'E-mail', children: [] },
  { kind: 'sub', key: 'P', label: 'Print', children: [] },
  { kind: 'sub', key: 'F1', label: 'Help', children: [] },
];

const MENU_HOTKEY_INDEX: Record<string, number> = {
  Company: 0,
  Data: 1,
  Exchange: 1,
  'Go To': 0,
  Import: 0,
  Export: 0,
  'E-mail': 2,
  Print: 0,
  Help: 0,
};

function MenuLabel({ label }: { label: string }) {
  const idx = MENU_HOTKEY_INDEX[label] ?? 0;
  if (idx < 0 || idx >= label.length) {
    return <>{label}</>;
  }
  return (
    <>
      {label.slice(0, idx)}
      <u className="font-semibold">{label[idx]}</u>
      {label.slice(idx + 1)}
    </>
  );
}

export function TallyTopMenu() {
  return (
    <header
      className="flex h-6 shrink-0 items-stretch border-b border-[#AAAAAA] bg-[#E8E8E8] px-0 text-[12px] text-[#000000]"
      style={{ letterSpacing: 0 }}
    >
      {MENU_ITEMS.map((item) => (
        <Popover key={item.label}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'border-r border-[#AAAAAA] py-0 text-left hover:bg-[#D5D5D5]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1976d2] focus-visible:outline-offset-[-2px]'
              )}
              style={{ padding: '3px 10px' }}
            >
              <MenuLabel label={item.label} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={0}
            className="w-56 rounded-none border border-[#AAAAAA] bg-[#FFFFFF] p-0 text-[12px] shadow-none"
          >
            {item.kind === 'sub' ? (
              item.children.length === 0 ? (
                <div className="px-2 py-1.5 text-[#555555]">—</div>
              ) : (
                <ul className="py-0.5">
                  {item.children.map((c) => (
                    <li key={c} className="cursor-default px-2 py-1 hover:bg-[#0D47A1] hover:text-white">
                      {c}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ul className="py-0.5">
                {item.actions.map((a) => (
                  <li key={a.label}>
                    {a.href ? (
                      <Link href={a.href} className="block px-2 py-1 hover:bg-[#0D47A1] hover:text-white">
                        {a.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full px-2 py-1 text-left hover:bg-[#0D47A1] hover:text-white"
                        onClick={a.onClick}
                      >
                        {a.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      ))}
    </header>
  );
}
