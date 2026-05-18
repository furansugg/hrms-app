"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      toast.error(t("login.invalid"));
      return;
    }
    toast.success(t("login.signedIn"));
    router.push(res?.url || callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("login.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("login.signingIn") : t("login.signIn")}
      </Button>
      <div className="text-center text-sm">
        <Link href="/forgot-password" className="text-emerald-700 hover:underline">Forgot password?</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useT();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-lg bg-emerald-500 flex items-center justify-center text-2xl font-bold text-slate-900">
            H
          </div>
          <CardTitle className="text-2xl">{t("login.welcome")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40 animate-pulse rounded bg-slate-100" />}>
            <LoginForm />
          </Suspense>
          <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold mb-1">{t("login.demoAccounts")}</div>
            <div>superadmin@hrms.local / Admin@123</div>
            <div>hr@hrms.local / Hr@1234</div>
            <div>manager@hrms.local / Manager@1</div>
            <div>employee@hrms.local / Employee@1</div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
