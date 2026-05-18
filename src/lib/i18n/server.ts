import "server-only";
import { cookies } from "next/headers";
import { parseLocale, tFor, type Locale } from "./dictionaries";

export function getServerLocale(): Locale {
  return parseLocale(cookies().get("locale")?.value);
}

export function getServerT() {
  const locale = getServerLocale();
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => tFor(locale, key, params),
  };
}
