'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTallyUi } from '@/components/tally/TallyUiContext';

function GatewayMenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--tally-separator)] last:border-b-0">
      <div
        className="uppercase"
        style={{
          fontSize: '11px',
          color: 'var(--tally-section-heading)',
          letterSpacing: '0.08em',
          fontWeight: 600,
          borderBottom: '1px solid var(--tally-separator)',
          padding: '4px 12px 3px',
          background: 'transparent',
        }}
      >
        {title}
      </div>
      <div className="py-0.5">{children}</div>
    </div>
  );
}

function GatewayMenuItem({
  hotkey,
  label,
  href,
  onClick,
}: {
  hotkey: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const idx = label.toUpperCase().indexOf(hotkey.toUpperCase());
  const labelNode =
    idx >= 0 ? (
      <>
        {label.substring(0, idx)}
        <u className="font-semibold">{label[idx]}</u>
        {label.substring(idx + 1)}
      </>
    ) : (
      label
    );

  const className =
    'group flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-[3px] text-left text-[13px] text-[var(--tally-text)] hover:bg-[#0D47A1] hover:text-white';

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span className="w-6 shrink-0 text-left text-[13px] font-bold text-[var(--tally-green)] group-hover:text-white">
          {hotkey}:
        </span>
        <span>{labelNode}</span>
      </button>
    );
  }

  return (
    <Link href={href ?? '#'} className={className}>
      <span className="w-6 shrink-0 text-left text-[13px] font-bold text-[var(--tally-green)] group-hover:text-white">
        {hotkey}:
      </span>
      <span>{labelNode}</span>
    </Link>
  );
}

export default function GatewayOfTallyPage() {
  const { dealer, logout } = useAuth();
  const { t } = useLanguage();
  const setButtons = useTallySetButtons();
  const { openPeriod } = useTallyUi();

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => openPeriod('date') },
      { label: 'Company', shortcut: 'F3' },
      { label: 'Configuration', shortcut: 'F4' },
      { label: 'Features', shortcut: 'F11' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriod]);

  const today = format(new Date(), 'd-MMM-yyyy');

  return (
    <div className="mx-auto flex max-w-[900px] flex-col" style={{ borderRadius: 0 }}>
      <div
        className="border border-[var(--tally-panel-border)] bg-[var(--tally-content-panel-bg)]"
        style={{ borderRadius: 0, boxShadow: 'none' }}
      >
        <div
          className="border-b py-[5px] text-center text-[13px] font-semibold tracking-wide text-white"
          style={{
            background: 'var(--tally-title-bar-bg)',
            borderBottomColor: 'var(--tally-title-bar-border)',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
          }}
        >
          {t('tally.gatewayTitle')}
        </div>

        <div className="flex flex-col md:flex-row">
          <div
            className="min-w-[200px] max-w-[220px] shrink-0 border-[var(--tally-panel-border)] py-0 md:border-r"
            style={{
              width: '100%',
              maxWidth: '220px',
              background: 'var(--tally-bg)',
              padding: '12px',
              fontSize: '12px',
            }}
          >
            <div className="mb-1 text-[var(--tally-text-muted)]">
              {t('tally.currentPeriod')}
            </div>
            <div className="mb-3 font-semibold tabular-nums text-[var(--tally-text)]">
              1-Apr-2025 to 31-Mar-2026
            </div>

            <div className="mb-1 text-[var(--tally-text-muted)]">
              {t('tally.currentDate')}
            </div>
            <div className="mb-3 font-semibold tabular-nums text-[var(--tally-text)]">{today}</div>

            <div className="mb-1 text-[var(--tally-text-muted)]">
              {t('tally.selectedCompanies')}
            </div>
            <div
              className="mt-1 w-full font-bold"
              style={{
                background: 'var(--tally-green-bg)',
                color: 'var(--tally-green)',
                padding: '3px 10px',
                borderLeft: '3px solid var(--tally-green)',
                fontSize: '13px',
                borderRadius: 0,
              }}
            >
              {dealer?.company_name ?? '—'}
            </div>
          </div>

          <div
            className="min-w-0 flex-1 border border-[#AAAAAA] bg-[var(--tally-content-panel-bg)]"
            style={{ boxShadow: 'none', borderRadius: 0 }}
          >
            <GatewayMenuSection title={t('tally.section.masters')}>
              <GatewayMenuItem hotkey="C" label="Create" href="/tally/masters/create" />
              <GatewayMenuItem hotkey="A" label="Alter" href="/tally/masters/alter" />
              <GatewayMenuItem hotkey="H" label="Chart of Accounts" href="/tally/coa" />
            </GatewayMenuSection>

            <GatewayMenuSection title={t('tally.section.transactions')}>
              <GatewayMenuItem hotkey="V" label="Vouchers" href="/tally/vouchers" />
              <GatewayMenuItem hotkey="D" label="Day Book" href="/tally/day-book" />
              <GatewayMenuItem hotkey="S" label="Supplier Master" href="/tally/purchase/suppliers" />
              <GatewayMenuItem hotkey="O" label="Purchase Order" href="/tally/purchase/po" />
              <GatewayMenuItem hotkey="G" label="Goods Receipt Note" href="/tally/purchase/grn" />
              <GatewayMenuItem hotkey="I" label="Purchase Invoice" href="/tally/purchase/invoices" />
            </GatewayMenuSection>

            <GatewayMenuSection title={t('tally.section.utilities')}>
              <GatewayMenuItem hotkey="B" label="Banking" href="/tally/banking" />
              <GatewayMenuItem hotkey="N" label="Bank Reconciliation" href="/tally/bank-rec" />
              <GatewayMenuItem hotkey="I" label="WhatsApp Inbox" href="/whatsapp" />
              <GatewayMenuItem hotkey="H" label="Scheme Tracker" href="/schemes" />
            </GatewayMenuSection>

            <GatewayMenuSection title={t('tally.section.reports')}>
              <GatewayMenuItem hotkey="K" label="Day Book" href="/tally/day-book" />
              <GatewayMenuItem hotkey="B" label="Balance Sheet" href="/tally/balance-sheet" />
              <GatewayMenuItem hotkey="P" label="Profit & Loss" href="/tally/profit-loss" />
              <GatewayMenuItem hotkey="T" label="Trial Balance" href="/tally/trial-balance" />
              <GatewayMenuItem hotkey="M" label="Stock Summary" href="/tally/stock-summary" />
              <GatewayMenuItem hotkey="W" label="Outstanding" href="/tally/outstanding" />
              <GatewayMenuItem hotkey="R" label="Ratio Analysis" href="/tally/ratio-analysis" />
              <GatewayMenuItem hotkey="J" label="GST Reports" href="/tally/gst" />
              <GatewayMenuItem hotkey="A" label="Payables Dashboard" href="/tally/purchase/payables" />
            </GatewayMenuSection>
          </div>
        </div>
      </div>

      <div className="w-full border-t border-[var(--tally-panel-border)]">
        <GatewayMenuItem hotkey="Q" label={t('tally.menu.quit')} onClick={() => logout()} />
      </div>
    </div>
  );
}
