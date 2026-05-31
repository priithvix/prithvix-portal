'use client';

import { usePathname, useRouter } from 'next/navigation';
import { usePdcAlertsQuery } from '@/hooks/useBankingQueries';

const TABS = [
  { key: 'gateway', label: 'Gateway', hotkey: 'G', href: '/tally' },
  { key: 'accounting', label: 'Accounting', hotkey: 'A', href: '/tally/accounting' },
  { key: 'purchase', label: 'Purchase & Stock', hotkey: 'P', href: '/tally/purchase' },
  { key: 'gst', label: 'GST', hotkey: 'T', href: '/tally/gst' },
  { key: 'banking', label: 'Banking', hotkey: 'B', href: '/tally/banking' },
  { key: 'reports', label: 'Reports', hotkey: 'R', href: '/tally/reports' },
  { key: 'settings', label: 'Settings', hotkey: 'S', href: '/tally/settings' },
] as const;

function activeKey(pathname: string) {
  if (pathname === '/tally') return 'gateway';
  if (pathname.startsWith('/tally/bank-rec')) return 'banking';
  const match = TABS.find((t) => t.href !== '/tally' && pathname.startsWith(t.href));
  return match?.key ?? 'gateway';
}

function TabLabel({ label, hotkey }: { label: string; hotkey: string }) {
  const hk = hotkey.toUpperCase();
  const upper = label.toUpperCase();
  let hotkeyIdx = -1;
  for (let i = 0; i < label.length; i++) {
    if (label[i].toUpperCase() === hk) {
      hotkeyIdx = i;
      break;
    }
  }
  if (hotkeyIdx < 0) hotkeyIdx = upper.indexOf(hk);
  if (hotkeyIdx < 0) return <>{label}</>;

  return (
    <>
      {label.slice(0, hotkeyIdx)}
      <u style={{ fontWeight: 700 }}>{label[hotkeyIdx]}</u>
      {label.slice(hotkeyIdx + 1)}
    </>
  );
}

export function TallyTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeKey(pathname);
  const { data: overduePdc = 0 } = usePdcAlertsQuery();

  return (
    <div
      className="flex shrink-0 items-end border-b border-[#AAAAAA] px-2 pt-1"
      style={{
        gap: '2px',
        minHeight: '27px',
        background: '#D8D8D8',
      }}
    >
      {TABS.map((tab) => {
        const isActive = current === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.push(tab.href)}
            className="relative flex cursor-pointer items-center gap-[2px] px-3 text-[12px]"
            style={{
              height: '26px',
              background: isActive ? '#FFF8E7' : '#E0E0E0',
              border: '1px solid #AAAAAA',
              borderBottom: isActive ? '1px solid #FFF8E7' : '1px solid #AAAAAA',
              color: isActive ? '#1B5E20' : '#444444',
              fontWeight: isActive ? 600 : 400,
              marginBottom: isActive ? '-1px' : '0',
              borderRadius: 0,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: 0,
            }}
          >
            <TabLabel label={tab.label} hotkey={tab.hotkey} />
            {tab.key === 'banking' && overduePdc > 0 ? (
              <span
                className="pointer-events-none absolute -right-[2px] -top-[2px] min-w-[16px] rounded-none border border-[#B71C1C] bg-[#D32F2F] px-[3px] text-center text-[9px] font-bold leading-none text-white"
                title="Overdue PDC reminders"
              >
                {overduePdc > 99 ? '99+' : overduePdc}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
