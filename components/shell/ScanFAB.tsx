'use client';

import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ScanFAB() {
  return (
    <Link href="/scan" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:hidden">
      <Button
        size="lg"
        className="h-[52px] w-[52px] rounded-full shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.4)] hover:shadow-[0_12px_32px_-4px_hsl(var(--primary)/0.5)] transition-shadow"
      >
        <ScanLine className="h-5 w-5" />
      </Button>
    </Link>
  );
}
