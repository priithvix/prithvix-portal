'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSales } from '@/contexts/SalesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LayoutDashboard,
  Users,
  IndianRupee,
  Package,
  BarChart3,
  Map,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  UserCog,
  Settings,
  ShoppingCart,
  History,
  Bell,
  Calendar,
  Lock,
  MoreHorizontal,
  Sprout,
  MessageCircle,
  ChevronsUpDown,
  User,
  LogOut,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
  badgeVariant?: 'default' | 'warning';
  onNavigate?: () => void;
}

function NavItem({ icon: Icon, label, href, badge, badgeVariant = 'default', onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'group relative flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-accent text-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
      )}
    >
      {/* Left accent bar on active */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}

      <Icon
        className={cn(
          'h-3.5 w-3.5 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />
      <span className="flex-1 truncate">{label}</span>

      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-2xs font-medium tabular-nums',
            badgeVariant === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

interface NavSectionProps {
  label: string;
  children: React.ReactNode;
}

function NavSection({ label, children }: NavSectionProps) {
  return (
    <div className="space-y-0.5">
      <div className="mb-1.5 px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        {label}
      </div>
      {children}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const { session, dealer, isDealer, logout } = useAuth();
  const { getCreditFarmers } = useSales();
  const { t } = useLanguage();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const creditFarmers = getCreditFarmers();
  const creditCount = creditFarmers.length;

  // TODO: Get actual compliance alert count
  const complianceAlerts = 0;

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex select-none">
      {/* Brand with gradient and glow */}
      <div className="flex h-12 items-center gap-2.5 border-b border-sidebar-border px-3">
        <div className="relative h-7 w-7 flex-shrink-0">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-strong shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.5)]">
            <Sprout className="h-4 w-4 text-white" strokeWidth={2.5} />
            {/* Highlight gleam */}
            <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-br from-white/20 to-transparent" />
          </div>
        </div>
        <div className="-space-y-0.5 flex flex-col">
          <span className="text-sm font-semibold tracking-tight">PrithviX</span>
          <span className="text-2xs font-medium text-muted-foreground">{t('nav.partner')}</span>
        </div>
      </div>

      {/* Workspace switcher */}
      <button className="mx-2 mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="bg-primary text-primary-foreground text-2xs font-semibold">
            {dealer?.company_name ? getInitials(dealer.company_name) : 'PX'}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate font-medium">{dealer?.company_name || t('shell.workspaceFallback')}</span>
        <ChevronsUpDown className="ml-auto h-3 w-3 text-muted-foreground" />
      </button>

      {/* Nav sections */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <NavSection label={t('nav.workspace')}>
          <NavItem icon={LayoutDashboard} label={t('nav.dashboard')} href="/home" onNavigate={onNavigate} />
          <NavItem icon={Users} label={t('nav.farmers')} href="/farmers" onNavigate={onNavigate} />
          <NavItem icon={IndianRupee} label={t('nav.udhaar')} href="/udhaar" badge={creditCount} onNavigate={onNavigate} />
        </NavSection>

        <NavSection label={t('nav.sales')}>
          <NavItem icon={ShoppingCart} label={t('nav.logVisit')} href="/log-visit" onNavigate={onNavigate} />
          <NavItem icon={History} label={t('nav.salesHistory')} href="/sales-history" onNavigate={onNavigate} />
          <NavItem icon={Bell} label={t('nav.smartFollowup')} href="/smart-followup" onNavigate={onNavigate} />
          <NavItem icon={Calendar} label={t('nav.cropCalendar')} href="/crop-calendar" onNavigate={onNavigate} />
          <NavItem icon={Lock} label={t('nav.closeDay')} href="/daily-close" onNavigate={onNavigate} />
        </NavSection>

        <NavSection label={t('nav.inventory')}>
          <NavItem icon={Package} label={t('nav.inventory')} href="/inventory" onNavigate={onNavigate} />
          {isDealer ? (
            <NavItem icon={Package} label="Batch tracking" href="/inventory/batches" onNavigate={onNavigate} />
          ) : null}
        </NavSection>

        <NavSection label="Agri">
          <NavItem icon={IndianRupee} label="Schemes & subsidies" href="/schemes" onNavigate={onNavigate} />
          <NavItem icon={Sprout} label="Crop cycles" href="/crop-cycles" onNavigate={onNavigate} />
          {isDealer ? (
            <NavItem icon={MessageCircle} label="WhatsApp orders" href="/whatsapp" onNavigate={onNavigate} />
          ) : null}
        </NavSection>

        {isDealer && (
          <NavSection label={t('nav.insights')}>
            <NavItem icon={BarChart3} label={t('nav.analytics')} href="/analytics" onNavigate={onNavigate} />
            <NavItem icon={Map} label={t('nav.salesMap')} href="/sales-map" onNavigate={onNavigate} />
          </NavSection>
        )}

        <NavSection label={t('nav.compliance')}>
          <NavItem
            icon={ShieldCheck}
            label={t('nav.compliance')}
            href="/compliance"
            badge={complianceAlerts}
            badgeVariant="warning"
            onNavigate={onNavigate}
          />
        </NavSection>

        <NavSection label={t('nav.more')}>
          <NavItem icon={Sparkles} label={t('nav.aiAgronomist')} href="/ai-agronomist" onNavigate={onNavigate} />
          <NavItem icon={MessageSquare} label={t('nav.broadcast')} href="/broadcast" onNavigate={onNavigate} />
          {isDealer && <NavItem icon={UserCog} label={t('nav.staff')} href="/staff-management" onNavigate={onNavigate} />}
          <NavItem icon={Settings} label={t('nav.settings')} href="/settings" onNavigate={onNavigate} />
        </NavSection>
      </nav>

      {/* Footer — user card with dropdown menu */}
      <div className="border-t border-sidebar-border p-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xs font-semibold">
                  {session ? getInitials(session.displayName) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium">{session?.displayName || 'User'}</p>
                <p className="truncate text-2xs text-muted-foreground">{isDealer ? t('nav.dealer') : t('nav.staff')}</p>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-2"
            align="start"
            side="right"
            sideOffset={8}
            collisionPadding={12}
          >
            <div className="space-y-1">
              {/* Profile */}
              <Link
                href="/profile"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <User className="h-4 w-4" />
                <span>{t('nav.profile')}</span>
              </Link>
              
              <Link
                href="/settings"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                <span>{t('nav.settings')}</span>
              </Link>

              <Link
                href="/profile/shop-details"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Store className="h-4 w-4" />
                <span>{t('nav.shopDetails')}</span>
              </Link>

              <div className="my-1 h-px bg-border" />

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  onNavigate?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
