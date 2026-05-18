"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import * as React from "react";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/dictionaries";

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider initialLocale={initialLocale}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </I18nProvider>
    </SessionProvider>
  );
}
