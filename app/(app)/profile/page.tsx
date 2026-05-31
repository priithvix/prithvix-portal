'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { useInventory } from '@/contexts/InventoryContext';
import type { Dealer } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageTransition } from '@/components/common/PageTransition';
import {
  Store,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Shield,
  Settings,
  Key,
  ChevronRight,
  Users,
  TrendingUp,
  Package,
  IndianRupee,
  FileText,
  Download,
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Pencil,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { formatINR } from '@/lib/format';
import Link from 'next/link';
import { getAvatarColor, getInitials } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LucideIcon } from 'lucide-react';

export type LicenseAlertSeverity = 'expired' | 'critical' | 'warning';

export interface LicenseAlertItem {
  type: string;
  message: string;
  severity: LicenseAlertSeverity;
}

export function getLicenseAlerts(dealer: Dealer | null): LicenseAlertItem[] {
  if (!dealer) return [];
  const licenses: { label: string; num?: string; exp?: string }[] = [
    { label: 'Fertilizer', num: dealer.fertilizer_license_number, exp: dealer.fertilizer_license_valid_until },
    { label: 'Pesticide', num: dealer.pesticide_license_number, exp: dealer.pesticide_license_valid_until },
    { label: 'Seed', num: dealer.seed_license_number, exp: dealer.seed_license_valid_until },
  ];
  const out: LicenseAlertItem[] = [];
  const today = new Date();
  for (const L of licenses) {
    if (!L.exp || !L.num) continue;
    const d = new Date(L.exp + (L.exp.length === 10 ? '' : ''));
    if (Number.isNaN(d.getTime())) continue;
    const days = differenceInDays(d, today);
    if (days < 0) {
      out.push({
        type: L.label,
        message: 'License has expired — renew immediately',
        severity: 'expired',
      });
    } else if (days < 30) {
      out.push({
        type: L.label,
        message: `Expires in ${days} day${days === 1 ? '' : 's'}`,
        severity: 'critical',
      });
    } else if (days < 90) {
      out.push({
        type: L.label,
        message: `Expires in ${days} days`,
        severity: 'warning',
      });
    }
  }
  return out;
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { session, dealer, accountStartDate, isDealer } = useAuth();
  const { farmers } = useData();
  const {
    monthSalesTotal,
    totalCreditOutstanding,
    allTimeSalesTotal,
    thisMonthSales,
  } = useSales();
  const { items } = useInventory();

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const userName = session?.displayName || 'User';
  const avatarColor = getAvatarColor(userName);
  const userInitials = getInitials(userName);

  const licenseAlerts = useMemo(() => (isDealer ? getLicenseAlerts(dealer ?? null) : []), [dealer, isDealer]);

  const showBanner = !bannerDismissed && licenseAlerts.length > 0;

  const stripTone = licenseAlerts.some((a) => a.severity === 'expired' || a.severity === 'critical')
    ? 'destructive'
    : 'amber';

  const quickLinks: {
    href: string;
    icon: LucideIcon;
    titleKey: string;
    descKey: string;
    color: string;
  }[] = [
    {
      href: '/profile/shop-details',
      icon: Store,
      titleKey: 'profile.linkShopTitle',
      descKey: 'profile.linkShopDesc',
      color: 'bg-primary/10 text-primary',
    },
    {
      href: '/settings',
      icon: Settings,
      titleKey: 'profile.linkSettingsTitle',
      descKey: 'profile.linkSettingsDesc',
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      href: '/invoice-settings',
      icon: FileText,
      titleKey: 'profile.linkInvoiceTitle',
      descKey: 'profile.linkInvoiceDesc',
      color: 'bg-purple-500/10 text-purple-500',
    },
    {
      href: '/profile/data-export',
      icon: Download,
      titleKey: 'profile.linkExportTitle',
      descKey: 'profile.linkExportDesc',
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      href: '/profile/change-password',
      icon: Key,
      titleKey: 'profile.linkPasswordTitle',
      descKey: 'profile.linkPasswordDesc',
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      href: '/profile/subscription',
      icon: CreditCard,
      titleKey: 'profile.linkSubscriptionTitle',
      descKey: 'profile.linkSubscriptionDesc',
      color: 'bg-rose-500/10 text-rose-600',
    },
  ];

  const stats = [
    {
      labelKey: 'profile.statTotalFarmers',
      value: String(farmers.length),
      icon: Users,
      color: 'text-primary',
      borderColor: 'border-l-primary',
    },
    {
      labelKey: 'profile.statMonthSales',
      value: formatINR(monthSalesTotal),
      icon: TrendingUp,
      color: 'text-success',
      borderColor: 'border-l-green-400',
    },
    {
      labelKey: 'profile.statCreditOutstanding',
      value: formatINR(totalCreditOutstanding),
      icon: IndianRupee,
      color: 'text-warning',
      borderColor: 'border-l-amber-400',
    },
    {
      labelKey: 'profile.statInventoryItems',
      value: String(items.length),
      icon: Package,
      color: 'text-info',
      borderColor: 'border-l-cyan-400',
    },
    {
      labelKey: 'profile.statTotalSalesAllTime',
      value: formatINR(allTimeSalesTotal),
      icon: IndianRupee,
      color: 'text-success',
      borderColor: 'border-l-emerald-500',
    },
    {
      labelKey: 'profile.statAvgSalePerFarmer',
      value:
        farmers.length > 0 ? formatINR(Math.round(allTimeSalesTotal / farmers.length)) : '₹0',
      icon: TrendingUp,
      color: 'text-purple-500',
      borderColor: 'border-l-purple-400',
    },
  ];

  const health = useMemo(() => {
    if (!dealer) {
      return { score: 0, items: [] as { label: string; earned: boolean }[] };
    }
    const items: { label: string; earned: boolean; pts: number }[] = [];
    let score = 0;

    const logo = Boolean(dealer.shop_logo_url?.trim());
    items.push({ label: 'Shop logo uploaded', earned: logo, pts: 10 });
    if (logo) score += 10;

    const gst = Boolean(dealer.gstin?.trim());
    items.push({ label: 'GSTIN on file', earned: gst, pts: 15 });
    if (gst) score += 15;

    const three =
      Boolean(dealer.fertilizer_license_number?.trim()) &&
      Boolean(dealer.pesticide_license_number?.trim()) &&
      Boolean(dealer.seed_license_number?.trim());
    items.push({ label: 'All three license numbers', earned: three, pts: 15 });
    if (three) score += 15;

    const alerts = getLicenseAlerts(dealer);
    const noCritical = !alerts.some((a) => a.severity === 'expired' || a.severity === 'critical');
    items.push({ label: 'No license expiring within 30 days', earned: noCritical, pts: 10 });
    if (noCritical) score += 10;

    const farmersOk = farmers.length > 5;
    items.push({ label: 'More than 5 farmers', earned: farmersOk, pts: 10 });
    if (farmersOk) score += 10;

    const soldThisMonth = thisMonthSales.length > 0;
    items.push({ label: 'Sale recorded this month', earned: soldThisMonth, pts: 15 });
    if (soldThisMonth) score += 15;

    const creditRatioOk =
      monthSalesTotal > 0 ? totalCreditOutstanding / monthSalesTotal < 0.2 : false;
    items.push({
      label: 'Udhaar under 20% of month sales',
      earned: creditRatioOk,
      pts: 15,
    });
    if (creditRatioOk) score += 15;

    const upi = Boolean(dealer.upi_id?.trim());
    items.push({ label: 'UPI ID configured', earned: upi, pts: 10 });
    if (upi) score += 10;

    return {
      score: Math.min(100, score),
      items: items.map(({ label, earned }) => ({ label, earned })),
    };
  }, [dealer, farmers.length, thisMonthSales.length, monthSalesTotal, totalCreditOutstanding]);

  const healthLabel =
    health.score > 70 ? 'Excellent' : health.score > 40 ? 'Good Standing' : 'Needs Attention';

  const licenses = useMemo(
    () => [
      {
        type: 'Fertilizer',
        number: dealer?.fertilizer_license_number,
        expiry: dealer?.fertilizer_license_valid_until,
      },
      {
        type: 'Pesticide',
        number: dealer?.pesticide_license_number,
        expiry: dealer?.pesticide_license_valid_until,
      },
      {
        type: 'Seed',
        number: dealer?.seed_license_number,
        expiry: dealer?.seed_license_valid_until,
      },
    ],
    [dealer]
  );

  return (
    <PageTransition>
      <div className="space-y-6 p-4 lg:p-6">
        {showBanner && (
          <div
            className={cn(
              'relative rounded-lg border p-3 flex items-start gap-3',
              stripTone === 'destructive'
                ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
            )}
          >
            <AlertTriangle
              className={cn(
                'h-5 w-5 shrink-0 mt-0.5',
                stripTone === 'destructive' ? 'text-red-500' : 'text-amber-500'
              )}
            />
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-semibold',
                  stripTone === 'destructive'
                    ? 'text-red-800 dark:text-red-400'
                    : 'text-amber-800 dark:text-amber-400'
                )}
              >
                License Expiry Alert
              </p>
              <ul className="mt-1 space-y-0.5">
                {licenseAlerts.map((a) => (
                  <li
                    key={`${a.type}-${a.message}`}
                    className={cn(
                      'text-xs',
                      stripTone === 'destructive'
                        ? 'text-red-700 dark:text-red-500'
                        : 'text-amber-700 dark:text-amber-500'
                    )}
                  >
                    {a.type}: {a.message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/profile/shop-details">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    'text-xs',
                    stripTone === 'destructive'
                      ? 'border-red-300 text-red-700'
                      : 'border-amber-300 text-amber-700'
                  )}
                >
                  Renew
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Dismiss"
                onClick={() => setBannerDismissed(true)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('profile.title')}</h1>
            <p className="mt-1 text-muted-foreground">{t('profile.tagline')}</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <Link
                  href="/profile/shop-details"
                  className="group relative block shrink-0"
                  title="Upload shop logo"
                >
                  <Avatar className="h-20 w-20 ring-2 ring-border transition group-hover:ring-primary">
                    {dealer?.shop_logo_url ? (
                      <AvatarImage src={dealer.shop_logo_url} alt="Shop" className="object-cover" />
                    ) : null}
                    <AvatarFallback
                      className="text-2xl font-bold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background">
                    <Camera className="h-4 w-4" />
                  </span>
                </Link>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold">{userName}</h2>
                    <Badge variant={isDealer ? 'default' : 'secondary'}>
                      {isDealer ? 'Dealer' : 'Staff'}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {dealer?.company_name && (
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {dealer.company_name}
                      </div>
                    )}
                    {dealer?.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {dealer.mobile}
                      </div>
                    )}
                    {dealer?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {dealer.email}
                      </div>
                    )}
                    {accountStartDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Member since {format(accountStartDate, 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/profile/shop-details">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Link>
                </Button>
                {dealer?.subscription_plan && (
                  <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-center">
                    <div className="text-xs font-medium text-muted-foreground">Plan</div>
                    <div className="mt-1 text-lg font-bold capitalize">
                      {dealer.subscription_plan}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(dealer?.village || dealer?.district || dealer?.state) && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  {[dealer.village, dealer.taluka, dealer.district, dealer.state]
                    .filter(Boolean)
                    .join(', ')}
                  {dealer.pin_code && ` - ${dealer.pin_code}`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.labelKey} className={cn('border-l-4', stat.borderColor)}>
              <CardContent className="p-3 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted-foreground">{t(stat.labelKey)}</div>
                    <div className="mt-1 truncate text-xl font-bold tabular-nums">{stat.value}</div>
                  </div>
                  <stat.icon className={cn('h-8 w-8 shrink-0', stat.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isDealer && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <span className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" /> Business Health Score
                </span>
                <span
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    health.score > 70
                      ? 'text-green-500'
                      : health.score > 40
                        ? 'text-amber-500'
                        : 'text-red-500'
                  )}
                >
                  {health.score}/100
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{healthLabel}</p>
            </CardHeader>
            <CardContent>
              <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-3 rounded-full transition-all',
                    health.score > 70
                      ? 'bg-green-500'
                      : health.score > 40
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  )}
                  style={{ width: `${health.score}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {health.items.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      item.earned ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {item.earned ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-accent">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        link.color
                      )}
                    >
                      <link.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{t(link.titleKey)}</div>
                      <div className="text-sm text-muted-foreground">{t(link.descKey)}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {isDealer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                License Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {licenses.map((license) => {
                  const daysLeft = license.expiry
                    ? differenceInDays(new Date(license.expiry), new Date())
                    : null;
                  const status =
                    daysLeft === null
                      ? 'unknown'
                      : daysLeft < 0
                        ? 'expired'
                        : daysLeft < 30
                          ? 'critical'
                          : daysLeft < 90
                            ? 'warning'
                            : 'valid';

                  return (
                    <div
                      key={license.type}
                      className={cn('rounded-lg border p-4', {
                        'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20':
                          status === 'valid',
                        'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20':
                          status === 'warning',
                        'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20':
                          status === 'critical' || status === 'expired',
                        'border-border bg-muted/30': status === 'unknown',
                      })}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {license.type}
                        </span>
                        <Badge
                          variant={status === 'valid' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {status === 'valid'
                            ? `${daysLeft}d left`
                            : status === 'expired'
                              ? 'EXPIRED'
                              : status === 'critical'
                                ? `${daysLeft}d left!`
                                : status === 'warning'
                                  ? `${daysLeft}d`
                                  : 'Not set'}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm">{license.number || '—'}</p>
                      {license.expiry && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expires {format(new Date(license.expiry), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!dealer?.fertilizer_license_number &&
                !dealer?.pesticide_license_number &&
                !dealer?.seed_license_number && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No license information available.{' '}
                      <Link href="/profile/shop-details" className="text-primary hover:underline">
                        Add license details
                      </Link>
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Dealer ID</span>
                <span className="font-mono text-right">{dealer?.dealer_id || '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Account Status</span>
                <Badge variant={dealer?.status === 'active' ? 'default' : 'secondary'}>
                  {dealer?.status || 'Active'}
                </Badge>
              </div>
              {dealer?.gstin && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">GSTIN</span>
                  <span className="font-mono">{dealer.gstin}</span>
                </div>
              )}
              {dealer?.state_code && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">State Code</span>
                  <span className="font-mono">{dealer.state_code}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
