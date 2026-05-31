'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ScanLine, Users } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Farmer } from '@/constants/types';

function normalizeDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function resolveFarmers(farmers: Farmer[], raw: string): Farmer[] {
  const q = raw.trim();
  if (!q) return [];

  const byExactId = farmers.filter((f) => f.id.toUpperCase() === q.toUpperCase());
  if (byExactId.length) return byExactId;

  const digits = normalizeDigits(q);
  if (digits.length === 10) {
    const byMobile = farmers.filter((f) => normalizeDigits(f.mobile) === digits);
    if (byMobile.length) return byMobile;
  }
  if (digits.length >= 6) {
    const partialMobile = farmers.filter((f) => normalizeDigits(f.mobile).includes(digits));
    if (partialMobile.length) return partialMobile;
  }

  const tail = q.toUpperCase();
  if (tail.startsWith('FMR')) {
    return farmers.filter((f) => f.id.toUpperCase().includes(tail.replace(/[^A-Z0-9_]/g, '')));
  }

  return [];
}

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { farmers, isLoading } = useData();

  const [query, setQuery] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const preset = searchParams.get('code') ?? searchParams.get('farmerId');
    if (preset) setQuery((prev) => (prev.trim() ? prev : preset.trim()));
  }, [searchParams]);

  const matches = useMemo(() => resolveFarmers(farmers, query), [farmers, query]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (!query.trim()) return;

    if (matches.length === 1) {
      toast.success(matches[0].fullName);
      router.push(`/log-visit?farmerId=${encodeURIComponent(matches[0].id)}`);
      return;
    }
    if (matches.length === 0) {
      toast.error(t('scan.noMatch'));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 lg:p-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <ScanLine className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <CardTitle className="text-xl">{t('scan.title')}</CardTitle>
          <CardDescription>{t('scan.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="scan-input">{t('scan.inputLabel')}</Label>
              <Input
                id="scan-input"
                name="scan"
                autoComplete="off"
                inputMode="text"
                placeholder={t('scan.inputPlaceholder')}
                value={query}
                disabled={isLoading}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAttempted(false);
                }}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {t('scan.lookup')}
            </Button>
          </form>

          {attempted && query.trim() && matches.length === 0 && (
            <p className="text-center text-sm text-muted-foreground" role="status">
              {t('scan.noMatch')}
            </p>
          )}

          {matches.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t('scan.matches').replace('{n}', String(matches.length))}
              </p>
              <ul className="max-h-[min(320px,50vh)] space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {matches.map((f) => (
                  <li key={f.id}>
                    <div className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{f.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.mobile} · <span className="font-mono">{f.id}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" asChild variant="default">
                          <Link href={`/log-visit?farmerId=${encodeURIComponent(f.id)}`}>{t('scan.logVisit')}</Link>
                        </Button>
                        <Button size="sm" asChild variant="outline">
                          <Link href={`/farmers/${f.id}`}>{t('scan.viewFarmer')}</Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full gap-2" asChild>
        <Link href="/farmers">
          <Users className="h-4 w-4" aria-hidden />
          {t('scan.browse')}
        </Link>
      </Button>
    </div>
  );
}
