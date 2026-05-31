'use client';

import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter, usePathname } from 'next/navigation';
import { useTallyUi } from '@/components/tally/TallyUiContext';
import { useAuth } from '@/contexts/AuthContext';
import { playTallyClick, playTallyError } from '@/lib/tally-sounds';

const SKIP_CLICK_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export function TallyKeyboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleCalculator, setGoToOpen, openPeriod } = useTallyUi();
  const { logout } = useAuth();

  const isGateway = pathname === '/tally';
  const isPurchaseHub = pathname === '/tally/purchase';
  const isPurchaseSection = (pathname ?? '').startsWith('/tally/purchase');

  /** Single-letter nav: play click only when key is not reserved for hub shortcuts. */
  useEffect(() => {
    const reserved = new Set([
      'k', 'K', 'b', 'B', 'p', 'P', 'm', 'M', 'w', 'W', 'j', 'J', 'i', 'I', 'a', 'A',
      's', 'S', 'o', 'O', 'g', 'G', 'd', 'D', 't', 'T', 'q', 'Q',
    ]);
    const handler = (e: KeyboardEvent) => {
      if (SKIP_CLICK_KEYS.has(e.key)) return;
      if (isGateway || isPurchaseHub) {
        if (reserved.has(e.key)) return;
        return;
      }
      if (isPurchaseSection) {
        if (reserved.has(e.key)) return;
      }
      playTallyClick();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isGateway, isPurchaseHub, isPurchaseSection]);

  useHotkeys('f2', () => openPeriod('date'), { enableOnFormTags: true });
  useHotkeys('alt+f2', () => openPeriod('range'), { enableOnFormTags: true });

  useHotkeys(
    'f4',
    () => router.push('/tally/voucher/new?type=CNT'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'f5',
    () => router.push('/tally/voucher/new?type=PMT'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'f6',
    () => router.push('/tally/voucher/new?type=RCT'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'f7',
    () => router.push('/tally/voucher/new?type=JNL'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'f8',
    () => router.push('/tally/voucher/new?type=SAL'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'f9',
    () => router.push('/tally/voucher/new?type=PUR'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'ctrl+f8',
    () => router.push('/tally/voucher/new?type=CRN'),
    { enableOnFormTags: true }
  );
  useHotkeys(
    'ctrl+f9',
    () => router.push('/tally/voucher/new?type=DBN'),
    { enableOnFormTags: true }
  );

  useHotkeys(
    'k',
    () => {
      if (isGateway) router.push('/tally/day-book');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'b',
    () => {
      if (isGateway) router.push('/tally/balance-sheet');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'p',
    () => {
      if (isPurchaseHub) router.push('/tally/purchase/supplier-ledger');
      else if (isGateway) router.push('/tally/profit-loss');
      else if (isPurchaseSection) return;
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'shift+t',
    () => {
      if (isGateway) router.push('/tally/trial-balance');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'm',
    () => {
      if (isGateway) router.push('/tally/stock-summary');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'w',
    () => {
      if (isGateway) router.push('/tally/outstanding');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'j',
    () => {
      if (isGateway) router.push('/tally/gst');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    's',
    () => {
      if (isGateway || isPurchaseHub || isPurchaseSection) router.push('/tally/purchase/suppliers');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'o',
    () => {
      if (isGateway || isPurchaseHub || isPurchaseSection) router.push('/tally/purchase/po');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'g',
    () => {
      if (pathname === '/tally/settings') return;
      if (pathname === '/tally/purchase/po') return;
      if (isGateway || isPurchaseHub || isPurchaseSection) router.push('/tally/purchase/grn');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'i',
    () => {
      if (isGateway || isPurchaseHub || isPurchaseSection) router.push('/tally/purchase/invoices');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'a',
    () => {
      if (pathname === '/tally/purchase/suppliers') return;
      if (isGateway || isPurchaseHub) router.push('/tally/purchase/payables');
      else if (isPurchaseSection) return;
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'd',
    () => {
      if (isPurchaseHub || isPurchaseSection) router.push('/tally/voucher/new?type=DBN');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    't',
    () => {
      if (isPurchaseHub || isPurchaseSection) router.push('/tally/stock-summary');
      else playTallyError();
    },
    { enableOnFormTags: false }
  );

  useHotkeys(
    'ctrl+a',
    (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('tally:save'));
    },
    { enableOnFormTags: true }
  );

  useHotkeys('escape', () => router.back(), { enableOnFormTags: false });

  useHotkeys('ctrl+n', () => toggleCalculator(), { enableOnFormTags: true });

  useHotkeys(
    'alt+g',
    (e) => {
      if (pathname === '/tally/purchase') {
        e.preventDefault();
        router.push('/tally/purchase/grn');
      } else {
        setGoToOpen(true);
      }
    },
    { enableOnFormTags: true }
  );

  useHotkeys(
    'alt+s',
    (e) => {
      if (pathname === '/tally/purchase') {
        e.preventDefault();
        router.push('/tally/purchase/suppliers');
      }
    },
    { enableOnFormTags: true }
  );

  useHotkeys(
    'alt+p',
    (e) => {
      if (pathname === '/tally/purchase') {
        e.preventDefault();
        router.push('/tally/purchase/payables');
      }
    },
    { enableOnFormTags: true }
  );

  useHotkeys('alt+1', () => router.push('/tally'), { enableOnFormTags: false });
  useHotkeys('alt+2', () => router.push('/tally/accounting'), { enableOnFormTags: false });
  useHotkeys('alt+3', () => router.push('/tally/purchase'), { enableOnFormTags: false });
  useHotkeys('alt+4', () => router.push('/tally/gst'), { enableOnFormTags: false });
  useHotkeys('alt+5', () => router.push('/tally/banking'), { enableOnFormTags: false });
  useHotkeys('alt+6', () => router.push('/tally/reports'), { enableOnFormTags: false });
  useHotkeys('alt+7', () => router.push('/tally/settings'), { enableOnFormTags: false });

  useHotkeys(
    'q',
    () => {
      void logout();
    },
    { enabled: isGateway, preventDefault: true, enableOnFormTags: false }
  );

  return <>{children}</>;
}
