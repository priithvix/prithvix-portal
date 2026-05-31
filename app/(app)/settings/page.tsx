'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase/client';
import { PageTransition } from '@/components/common/PageTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Bell,
  FileText,
  Monitor,
  Sun,
  Moon,
  Palette,
  Database,
  Shield,
  Loader2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataExportDownloads } from '@/hooks/use-data-export';

const NOTIFICATION_KEY = 'prithvix_notifications';
const DISPLAY_KEY = 'prithvix_display_prefs';

type NotificationPrefs = {
  creditDueReminders: boolean;
  lowStockAlerts: boolean;
  followUpReminders: boolean;
  salesMilestone: boolean;
  licenseExpiryWarnings: boolean;
  dailyCloseReminder: boolean;
};

type DisplayPrefs = {
  theme: 'system' | 'light' | 'dark';
  language: 'en' | 'hi' | 'gu' | 'mr';
  currencyFormat: 'in' | 'intl';
  dateFormat: 'ddmm' | 'mmdd' | 'ddmon';
  itemsPerPage: 10 | 25 | 50;
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  creditDueReminders: true,
  lowStockAlerts: true,
  followUpReminders: true,
  salesMilestone: true,
  licenseExpiryWarnings: true,
  dailyCloseReminder: false,
};

const DEFAULT_DISPLAY: DisplayPrefs = {
  theme: 'system',
  language: 'en',
  currencyFormat: 'in',
  dateFormat: 'ddmm',
  itemsPerPage: 25,
};

type InvoiceForm = {
  defaultPaymentMode: 'cash' | 'upi' | 'credit';
  defaultGstRate: 0 | 5 | 12 | 18;
  invoicePrefix: string;
  footerText: string;
  showLogoOnInvoice: boolean;
  showGstBreakdown: boolean;
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function SettingsPage() {
  const { dealer, refreshDealer } = useAuth();
  const { setTheme } = useTheme();
  const { language, setLanguage, availableLanguages, t } = useLanguage();
  const exports = useDataExportDownloads();

  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [display, setDisplay] = useState<DisplayPrefs>(DEFAULT_DISPLAY);
  const [invoice, setInvoice] = useState<InvoiceForm>({
    defaultPaymentMode: 'cash',
    defaultGstRate: 18,
    invoicePrefix: 'INV',
    footerText: 'Thank you for your business!',
    showLogoOnInvoice: true,
    showGstBreakdown: true,
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    const n = loadJson(NOTIFICATION_KEY, DEFAULT_NOTIFICATIONS);
    setNotifications(n);
    const d = loadJson(DISPLAY_KEY, DEFAULT_DISPLAY);
    setDisplay(d);
    if (d.theme === 'light' || d.theme === 'dark' || d.theme === 'system') {
      setTheme(d.theme);
    }
  }, [setTheme]);

  useEffect(() => {
    const inv = dealer?.invoice_settings as Partial<InvoiceForm> | undefined;
    if (!inv || typeof inv !== 'object') return;
    const gr = Number(inv.defaultGstRate);
    const gstOk = [0, 5, 12, 18].includes(gr) ? (gr as 0 | 5 | 12 | 18) : undefined;
    const pm = inv.defaultPaymentMode;
    setInvoice((prev) => ({
      ...prev,
      defaultPaymentMode:
        pm === 'cash' || pm === 'upi' || pm === 'credit' ? pm : prev.defaultPaymentMode,
      defaultGstRate: gstOk !== undefined ? (gstOk as 0 | 5 | 12 | 18) : prev.defaultGstRate,
      invoicePrefix: typeof inv.invoicePrefix === 'string' ? inv.invoicePrefix : prev.invoicePrefix,
      footerText: typeof inv.footerText === 'string' ? inv.footerText : prev.footerText,
      showLogoOnInvoice:
        typeof inv.showLogoOnInvoice === 'boolean' ? inv.showLogoOnInvoice : prev.showLogoOnInvoice,
      showGstBreakdown:
        typeof inv.showGstBreakdown === 'boolean' ? inv.showGstBreakdown : prev.showGstBreakdown,
    }));
  }, [dealer?.invoice_settings]);

  const persistNotifications = (next: NotificationPrefs) => {
    setNotifications(next);
    saveJson(NOTIFICATION_KEY, next);
    toast.success('Notification preferences saved');
  };

  const persistDisplay = (next: DisplayPrefs, showToast = true) => {
    const merged = { ...next, language };
    setDisplay(merged);
    saveJson(DISPLAY_KEY, merged);
    if (next.theme) setTheme(next.theme);
    if (showToast) toast.success('Display preferences saved');
  };

  const handleSaveInvoice = async () => {
    if (!dealer) {
      toast.error('Not signed in as dealer');
      return;
    }
    setSavingInvoice(true);
    try {
      const payload = {
        defaultPaymentMode: invoice.defaultPaymentMode,
        defaultGstRate: invoice.defaultGstRate,
        invoicePrefix: invoice.invoicePrefix,
        footerText: invoice.footerText,
        showLogoOnInvoice: invoice.showLogoOnInvoice,
        showGstBreakdown: invoice.showGstBreakdown,
      };
      const { error } = await supabase
        .from('dealers')
        .update({ invoice_settings: payload })
        .eq('id', dealer.id);
      if (error) throw error;
      await refreshDealer();
      toast.success('Invoice defaults saved');
    } catch (e) {
      console.error(e);
      toast.error('Could not save invoice settings. Ensure invoice_settings exists on dealers table.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const themePrefs = useMemo(
    () =>
      [
        { id: 'system' as const, labelKey: 'settings.themeSystem', icon: Monitor },
        { id: 'light' as const, labelKey: 'settings.themeLight', icon: Sun },
        { id: 'dark' as const, labelKey: 'settings.themeDark', icon: Moon },
      ],
    []
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-8 p-4 lg:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('settings.subtitle')}</p>
        </div>

        {/* Section 1 — Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('settings.notifications')}
            </CardTitle>
            <CardDescription>
              Stored on this device ({NOTIFICATION_KEY})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ['creditDueReminders', 'Credit due reminders', 'Alert when farmer credit > 30 days'],
                ['lowStockAlerts', 'Low stock alerts', 'Alert when SKU stock is below reorder level'],
                ['followUpReminders', 'Follow-up reminders', "Morning reminder for today's follow-ups"],
                ['salesMilestone', 'Sales milestone', 'Celebrate when monthly sales exceed last month'],
                [
                  'licenseExpiryWarnings',
                  'License expiry warnings',
                  '90-day and 30-day warnings for licenses',
                ],
                ['dailyCloseReminder', 'Daily close reminder', 'Remind at 7pm to close the day'],
              ] as const
            ).map(([key, title, desc]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={notifications[key]}
                  onCheckedChange={(v) =>
                    persistNotifications({ ...notifications, [key]: v })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 2 — Invoice defaults (Supabase) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('settings.invoiceDefaults')}
            </CardTitle>
            <CardDescription>Saved to your dealer profile (invoice_settings)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Default payment mode</Label>
              <div className="flex flex-wrap gap-2">
                {(['cash', 'upi', 'credit'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setInvoice({ ...invoice, defaultPaymentMode: m })}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm capitalize',
                      invoice.defaultPaymentMode === m
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default GST rate</Label>
              <div className="flex flex-wrap gap-2">
                {([0, 5, 12, 18] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInvoice({ ...invoice, defaultGstRate: r })}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm',
                      invoice.defaultGstRate === r
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="invPrefix">Invoice prefix</Label>
              <Input
                id="invPrefix"
                value={invoice.invoicePrefix}
                onChange={(e) => setInvoice({ ...invoice, invoicePrefix: e.target.value })}
                className="mt-1.5"
                placeholder="INV"
              />
            </div>
            <div>
              <Label htmlFor="invFooter">Invoice footer text</Label>
              <Textarea
                id="invFooter"
                value={invoice.footerText}
                onChange={(e) => setInvoice({ ...invoice, footerText: e.target.value })}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show dealer logo on invoice</p>
                <p className="text-xs text-muted-foreground">When generating PDF / print</p>
              </div>
              <Switch
                checked={invoice.showLogoOnInvoice}
                onCheckedChange={(v) => setInvoice({ ...invoice, showLogoOnInvoice: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show GST breakdown on invoice</p>
                <p className="text-xs text-muted-foreground">Line-wise tax where applicable</p>
              </div>
              <Switch
                checked={invoice.showGstBreakdown}
                onCheckedChange={(v) => setInvoice({ ...invoice, showGstBreakdown: v })}
              />
            </div>
            <Button onClick={handleSaveInvoice} disabled={savingInvoice} className="w-full sm:w-auto">
              {savingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.saveInvoiceDefaults')}
            </Button>
          </CardContent>
        </Card>

        {/* Section 3 — Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.display')}
            </CardTitle>
            <CardDescription>Theme and layout hints ({DISPLAY_KEY})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('settings.theme')}</Label>
              <div className="flex flex-wrap gap-2">
                {themePrefs.map(({ id, labelKey, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => persistDisplay({ ...display, theme: id }, true)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                      display.theme === id
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">{t('settings.language')}</Label>
              <p className="mb-3 text-xs text-muted-foreground">{t('settings.langHint')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-medium transition-all',
                      language === lang.code
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted',
                    )}
                  >
                    <span className="text-2xl">
                      {lang.code === 'en'
                        ? '🇬🇧'
                        : lang.code === 'hi'
                          ? '🇮🇳'
                          : lang.code === 'gu'
                            ? '🟡'
                            : '🟠'}
                    </span>
                    <span>{lang.name}</span>
                    {language === lang.code && (
                      <span className="text-xs text-primary">{t('settings.active')}</span>
                    )}
                  </button>
                ))}
              </div>
              {language !== 'en' && (
                <p className="mt-2 text-xs text-muted-foreground">{t('settings.langPartialNote')}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 border-y border-border py-3">
              <div>
                <p className="text-sm font-medium">Currency display</p>
                <p className="text-xs text-muted-foreground">
                  Indian lakhs format vs international grouping
                </p>
              </div>
              <div className="flex rounded-md border p-0.5">
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1 text-xs',
                    display.currencyFormat === 'in' ? 'bg-muted font-medium' : ''
                  )}
                  onClick={() => persistDisplay({ ...display, currencyFormat: 'in' })}
                >
                  ₹1,23,456
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1 text-xs',
                    display.currencyFormat === 'intl' ? 'bg-muted font-medium' : ''
                  )}
                  onClick={() => persistDisplay({ ...display, currencyFormat: 'intl' })}
                >
                  ₹123,456
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date format</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['ddmm', 'DD/MM/YYYY'],
                    ['mmdd', 'MM/DD/YYYY'],
                    ['ddmon', 'DD MMM YYYY'],
                  ] as const
                ).map(([id, lab]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => persistDisplay({ ...display, dateFormat: id })}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs',
                      display.dateFormat === id ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Items per page (tables)</Label>
              <div className="flex gap-2">
                {([10, 25, 50] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => persistDisplay({ ...display, itemsPerPage: n })}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm tabular-nums',
                      display.itemsPerPage === n ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4 — Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t('settings.dataManagement')}
            </CardTitle>
            <CardDescription>Export data already loaded in the app (same as Profile → Export)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="justify-start"
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadFarmers()}
            >
              {exports.isLoading('farmers') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export farmers (CSV)
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadSales()}
            >
              {exports.isLoading('sales') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export sales (CSV)
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadInventory()}
            >
              {exports.isLoading('inventory') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export inventory (CSV)
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={exports.isAnyLoading}
              onClick={() => exports.downloadBackup()}
            >
              {exports.isLoading('backup') ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Backup JSON
            </Button>
          </CardContent>
        </Card>

        {/* Section 5 — Danger */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Account — danger zone
            </CardTitle>
            <CardDescription>Irreversible or sensitive actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Log out from all devices</p>
                <p className="text-xs text-muted-foreground">
                  Ends every active session for this account
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => {
                  if (
                    !window.confirm(
                      'Log out from all devices? You will need to sign in again everywhere.'
                    )
                  )
                    return;
                  void supabase.auth.signOut({ scope: 'global' }).then(() => {
                    toast.success('Signed out from all devices');
                  });
                }}
              >
                Sign out everywhere
              </Button>
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Deactivate account</p>
                <p className="text-xs text-muted-foreground">
                  Flags your workspace for review. Contact support to complete closure.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive"
                onClick={() =>
                  toast.info('Please email support from your registered ID to deactivate.')
                }
              >
                Request deactivation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
