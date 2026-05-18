"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import * as React from "react";
import { LanguageProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </LanguageProvider>
    </SessionProvider>
  );
}
