'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export function TallyComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useLanguage();
  return (
    <div className="border border-[var(--tally-border)] bg-[var(--tally-input-bg)] text-[13px] text-[var(--tally-text)]">
      <h1 className="border-b border-[var(--tally-border)] bg-[var(--tally-green)] px-3 py-1 text-sm font-semibold text-white">
        {t(titleKey)}
      </h1>
      <div className="p-4">
        <p className="text-[var(--tally-text-muted)]">{t('tally.stub.body')}</p>
        <Link href="/tally" className="mt-4 inline-block underline underline-offset-2">
          {t('tally.stub.gateway')}
        </Link>
      </div>
    </div>
  );
}
