'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TallyVoucherScreen } from '@/components/tally/TallyVoucherScreen';

function VoucherInner() {
  const sp = useSearchParams();
  const type = sp.get('type') ?? 'SAL';
  return <TallyVoucherScreen voucherType={type} />;
}

export default function NewVoucherPage() {
  return (
    <Suspense fallback={<div className="text-[13px] text-[var(--tally-text)]">Loading…</div>}>
      <VoucherInner />
    </Suspense>
  );
}
