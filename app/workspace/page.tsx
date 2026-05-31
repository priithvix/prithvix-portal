'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sprout, Calculator } from 'lucide-react';
import { AuthVisualPanel } from '@/components/auth/AuthVisualPanel';
import { setWorkspaceMode } from '@/lib/workspace';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function WorkspacePickerPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function pickMode(mode: 'business_engine' | 'tally') {
    if (busy) return;
    setBusy(true);
    try {
      await setWorkspaceMode(mode);
      if (mode === 'business_engine') router.replace('/home');
      else router.replace('/tally');
    } catch {
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="col-span-full h-1 shrink-0 bg-gradient-to-r from-primary via-primary-strong to-primary lg:hidden"
        aria-hidden
      />

      <AuthVisualPanel
        imageSrc="/auth/workspace.png"
        imageAlt="Indian agri-retail shop interior"
        headline="Two ways to run your books."
        subline="Pick Business Engine for daily operations, or Tally Mode for accounting. Your data is the same in both."
        badge="CHOOSE YOUR WORKSPACE"
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-3xl"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('workspace.title')}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">{t('workspace.subtitle')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => pickMode('business_engine')}
              className={cn(
                'group relative rounded-xl border border-border bg-card p-6 text-left transition-all',
                'hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.2)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-strong shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
                <Sprout className="h-5 w-5 text-white" />
              </div>
              <h2 className="mb-1.5 text-base font-semibold tracking-tight">
                {t('workspace.businessTitle')}
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                {t('workspace.businessDesc')}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {t('workspace.businessBullet1')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {t('workspace.businessBullet2')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {t('workspace.businessBullet3')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {t('workspace.businessBullet4')}
                </li>
              </ul>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-primary transition-all group-hover:gap-2">
                {t('workspace.businessContinue')}
                <span aria-hidden>→</span>
              </div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => pickMode('tally')}
              className={cn(
                'group relative rounded-xl border border-border bg-card p-6 text-left transition-all',
                'hover:border-[#FFD700] hover:shadow-[0_8px_24px_-8px_rgba(255,215,0,0.3)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#1B5E20] to-[#0D3D0F] shadow-[0_4px_12px_-2px_rgba(27,94,32,0.4)]">
                <Calculator className="h-5 w-5 text-[#FFD700]" />
              </div>
              <h2 className="mb-1.5 text-base font-semibold tracking-tight">
                {t('workspace.tallyTitle')}
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                {t('workspace.tallyDesc')}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                  {t('workspace.tallyBullet1')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                  {t('workspace.tallyBullet2')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                  {t('workspace.tallyBullet3')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#1B5E20]" />
                  {t('workspace.tallyBullet4')}
                </li>
              </ul>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-[#1B5E20] transition-all group-hover:gap-2 dark:text-[#4ADE80]">
                {t('workspace.tallyContinue')}
                <span aria-hidden>→</span>
              </div>
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">{t('workspace.footerNote')}</p>
        </motion.div>
      </div>
    </div>
  );
}
