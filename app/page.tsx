'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashPage() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isReady, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-green-700 to-green-600">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">PrithviX</h1>
        <p className="text-white/80 text-lg mb-8">Partner Portal</p>
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
