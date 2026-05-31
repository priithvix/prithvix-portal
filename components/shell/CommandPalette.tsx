'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useData } from '@/contexts/DataContext';
import {
  Search,
  Users,
  Package,
  FileText,
  Home,
  ShoppingCart,
  BarChart3,
  Shield,
  Calendar,
  MapPin,
  Radio,
  Brain,
  Settings,
  User,
  Leaf,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { farmers } = useData();
  const [search, setSearch] = useState('');

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Filter results
  const filteredFarmers = useMemo(() => {
    if (!search) return [];
    const query = search.toLowerCase();
    return farmers
      .filter(
        (f) =>
          f.fullName.toLowerCase().includes(query) ||
          f.mobile.includes(query) ||
          f.id.toLowerCase().includes(query) ||
          f.village.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [farmers, search]);

  const pages = [
    { name: 'Dashboard', icon: Home, href: '/home' },
    { name: 'Farmers', icon: Users, href: '/farmers' },
    { name: 'Register Farmer', icon: Users, href: '/register-farmer' },
    { name: 'Log Visit', icon: Leaf, href: '/log-visit' },
    { name: 'Scan QR', icon: Search, href: '/scan' },
    { name: 'Udhaar', icon: TrendingUp, href: '/udhaar' },
    { name: 'Sales History', icon: ShoppingCart, href: '/sales-history' },
    { name: 'Inventory', icon: Package, href: '/inventory' },
    { name: 'Invoice', icon: FileText, href: '/invoice' },
    { name: 'Analytics', icon: BarChart3, href: '/analytics' },
    { name: 'Compliance', icon: Shield, href: '/compliance' },
    { name: 'Smart Follow-up', icon: Calendar, href: '/smart-followup' },
    { name: 'Sales Map', icon: MapPin, href: '/sales-map' },
    { name: 'Broadcast', icon: Radio, href: '/broadcast' },
    { name: 'AI Agronomist', icon: Brain, href: '/ai-agronomist' },
    { name: 'Crop Calendar', icon: Calendar, href: '/crop-calendar' },
    { name: 'Profile', icon: User, href: '/profile' },
    { name: 'More', icon: Settings, href: '/more' },
  ];

  const filteredPages = useMemo(() => {
    if (!search) return pages.slice(0, 8);
    const query = search.toLowerCase();
    return pages.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 5);
  }, [search]);

  const handleSelect = useCallback(
    (callback: () => void) => {
      onOpenChange(false);
      callback();
    },
    [onOpenChange]
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Command Palette */}
      <div
        className={cn(
          'fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2 transition-all duration-200',
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        <Command
          className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          shouldFilter={false}
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search farmers, sales, SKUs, or navigate..."
              className="flex h-12 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="ml-auto hidden rounded border border-border bg-muted px-2 py-1 text-xs font-mono text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Pages */}
            {filteredPages.length > 0 && (
              <Command.Group
                heading="Pages"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {filteredPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Command.Item
                      key={page.href}
                      value={page.name}
                      onSelect={() => handleSelect(() => router.push(page.href))}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{page.name}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Farmers */}
            {filteredFarmers.length > 0 && (
              <Command.Group
                heading="Farmers"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {filteredFarmers.map((farmer) => (
                  <Command.Item
                    key={farmer.id}
                    value={farmer.fullName}
                    onSelect={() => handleSelect(() => router.push(`/farmers/${farmer.id}`))}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                      <Users className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate font-medium">{farmer.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {farmer.mobile} · {farmer.village}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </>
  );
}
