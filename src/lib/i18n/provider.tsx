"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, type Locale, parseLocale, tFor } from "./dictionaries";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

const COOKIE = "locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

function writeLocaleCookie(l: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${l}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  try {
    window.localStorage.setItem(COOKIE, l);
  } catch {
    // ignore quota / private-mode errors
  }
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // If localStorage has a value the cookie missed (e.g. first SSR render), reconcile.
  useEffect(() => {
    try {
      const stored = parseLocale(window.localStorage.getItem(COOKIE));
      if (stored !== locale) {
        setLocaleState(stored);
        writeLocaleCookie(stored);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    writeLocaleCookie(l);
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => tFor(locale, key, params),
    [locale]
  );

  const value = useMemo<Ctx>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
