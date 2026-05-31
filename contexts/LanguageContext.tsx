'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Language, translations, LANGUAGE_NAMES } from '@/lib/i18n/translations';

const STORAGE_KEY = 'prithvix_lang';
const LEGACY_LANGUAGE_KEY = 'prithvix_language';
const DISPLAY_PREFS_KEY = 'prithvix_display_prefs';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  languageName: string;
  availableLanguages: { code: Language; name: string }[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

function syncDisplayPrefsLanguage(lang: Language) {
  try {
    const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
    const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify({ ...base, language: lang }));
  } catch {
    /* ignore */
  }
}

function readStoredLanguage(): Language | null {
  try {
    const primary = localStorage.getItem(STORAGE_KEY) as Language;
    if (primary && translations[primary]) return primary;

    const legacy = localStorage.getItem(LEGACY_LANGUAGE_KEY) as Language;
    if (legacy && translations[legacy]) return legacy;

    const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { language?: string };
      const c = d.language as Language | undefined;
      if (c && translations[c]) return c;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>('en');

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored) {
      setLang(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.removeItem(LEGACY_LANGUAGE_KEY);
      syncDisplayPrefsLanguage(lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[language]?.[key] ?? translations.en[key] ?? fallback ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languageName: LANGUAGE_NAMES[language],
        availableLanguages: Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
          code: code as Language,
          name,
        })),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
