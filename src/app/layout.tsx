import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getServerLocale } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HRMS",
  description: "Human Resource Management System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = getServerLocale();
  return (
    <html lang={locale}>
      <body className={inter.className + " bg-slate-50 text-slate-900"}>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
