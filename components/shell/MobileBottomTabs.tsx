'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Wallet, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Farmers', href: '/farmers', icon: Users },
  { label: 'Udhaar', href: '/udhaar', icon: Wallet },
  { label: 'More', href: '/more', icon: MoreHorizontal },
];

export function MobileBottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background/80 backdrop-blur-md md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2"
          >
            <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-2xs font-medium transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground')}>
              {tab.label}
            </span>
            {isActive && <div className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
