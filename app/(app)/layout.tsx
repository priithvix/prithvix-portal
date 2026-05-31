'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { MobileBottomTabs } from '@/components/shell/MobileBottomTabs';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isReady, loading } = useAuth();

  useEffect(() => {
    if (isReady && !isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loading, router]);

  // Show loading state while checking auth
  if (!isReady || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render app shell if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar (≥768px) */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar />

        {/* Page Content */}
        <main className="app-main-canvas flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Tabs (<768px) */}
        <div className="md:hidden">
          <MobileBottomTabs />
        </div>
      </div>

    </div>
  );
}
