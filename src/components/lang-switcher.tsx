"use client";

import { Languages } from "lucide-react";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { useT } from "@/lib/i18n/provider";

export function LangSwitcher() {
  const { locale, setLocale, t } = useT();
  return (
    <label
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
      title={t("topbar.language")}
    >
      <Languages className="h-4 w-4 text-slate-500" />
      <span className="sr-only">{t("topbar.language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
