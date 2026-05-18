"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import en from "./en";
import type { Translations } from "./en";
import id from "./id";

export type Locale = "en" | "id";

const translations: Record<Locale, Translations> = { en, id };

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("hrms-locale") as Locale | null;
    if (saved && (saved === "en" || saved === "id")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("hrms-locale", l);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const { t } = useContext(I18nContext);
  return t;
}

export function useLanguage() {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}
