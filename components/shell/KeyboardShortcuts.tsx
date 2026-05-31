'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';

interface KeyboardShortcutsProps {
  onOpenCommandPalette: () => void;
}

export function KeyboardShortcuts({ onOpenCommandPalette }: KeyboardShortcutsProps) {
  const router = useRouter();

  // Command Palette
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    onOpenCommandPalette();
  }, { enableOnFormTags: true });

  // New Farmer
  useHotkeys('mod+n', (e) => {
    e.preventDefault();
    router.push('/register-farmer');
  });

  // New Sale
  useHotkeys('mod+s', (e) => {
    e.preventDefault();
    router.push('/log-visit');
  });

  // Inventory
  useHotkeys('mod+i', (e) => {
    e.preventDefault();
    router.push('/inventory');
  });

  // Dashboard
  useHotkeys('mod+h', (e) => {
    e.preventDefault();
    router.push('/home');
  });

  return null;
}
