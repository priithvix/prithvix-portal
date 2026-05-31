'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Bell, Menu, Plus, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { KeyboardShortcuts } from '@/components/shell/KeyboardShortcuts';
import { Sidebar } from '@/components/shell/Sidebar';
import { getAvatarColor, getInitials } from '@/lib/avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/home': 'Dashboard',
  '/farmers': 'Farmers',
  '/scan': 'Scan QR',
  '/udhaar': 'Udhaar',
  '/sales-history': 'Sales History',
  '/inventory': 'Inventory',
  '/invoice': 'Invoice',
  '/analytics': 'Analytics',
  '/compliance': 'Compliance',
  '/smart-followup': 'Smart Follow-up',
  '/sales-map': 'Sales Map',
  '/broadcast': 'Broadcast',
  '/ai-agronomist': 'AI Agronomist',
  '/crop-calendar': 'Crop Calendar',
  '/log-visit': 'Log Visit',
  '/daily-close': 'Daily Close',
  '/profile': 'Profile',
  '/staff-management': 'Staff Management',
  '/more': 'More',
};

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPageTitle = PAGE_TITLES[pathname] || 'PrithviX';

  const userName = session?.displayName || 'User';
  const avatarColor = getAvatarColor(userName);
  const userInitials = getInitials(userName);

  // TODO: Calculate actual compliance alert count from licenses validity
  const alertCount = 0;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background px-4 select-none">
      {/* Mobile menu trigger (only on mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 md:hidden"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs (desktop) */}
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
        <span>Workspace</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">{currentPageTitle}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search (cmd+k style) - premium version */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setCommandOpen(true)}
            className={cn(
              'group hidden items-center gap-2 h-8 px-2.5 rounded-md md:flex',
              'border border-border bg-gradient-to-b from-card to-muted/30',
              'hover:border-foreground/20 hover:from-card hover:to-muted/50',
              'transition-all duration-150 text-xs text-muted-foreground min-w-[240px]'
            )}
          >
            <Search className="h-3.5 w-3.5 transition-colors group-hover:text-foreground" />
            <span>Search farmers, sales, SKUs…</span>
            <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-2xs shadow-sm">
              ⌘K
            </kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Search (⌘K)</p>
        </TooltipContent>
      </Tooltip>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts onOpenCommandPalette={() => setCommandOpen(true)} />

      {/* Quick actions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/log-visit">
            <Button size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">New Sale</span>
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>New Sale (⌘S)</p>
        </TooltipContent>
      </Tooltip>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Compliance alerts */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/compliance">
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Compliance Alerts</p>
        </TooltipContent>
      </Tooltip>

      {/* Profile */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <Avatar className="h-7 w-7 transition-transform hover:scale-105">
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Profile Settings</p>
        </TooltipContent>
      </Tooltip>
    </header>
    </TooltipProvider>
  );
}
