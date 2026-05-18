"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { useT } from "@/lib/i18n/provider";

type Settings = {
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  logoUrl: string | null;
  workStartTime: string;
  workEndTime: string;
  lateThresholdTime: string;
  annualLeaveDefault: number;
  currency: string;
  lateDeductionPerDay: number;
};

const empty: Settings = {
  companyName: "",
  companyAddress: "",
  companyEmail: "",
  companyPhone: "",
  logoUrl: "",
  workStartTime: "08:00",
  workEndTime: "17:00",
  lateThresholdTime: "08:15",
  annualLeaveDefault: 12,
  currency: "IDR",
  lateDeductionPerDay: 50000,
};

export default function SettingsPage() {
  const { t } = useT();
  const [form, setForm] = useState<Settings>(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setForm({ ...empty, ...d }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        annualLeaveDefault: Number(form.annualLeaveDefault),
        lateDeductionPerDay: Number(form.lateDeductionPerDay),
      }),
    });
    setLoading(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("settings.toastSaved"));
  }

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("common.name")}</CardTitle>
            <CardDescription>{t("settings.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("settings.companyName")}</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={form.companyAddress ?? ""}
                onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input
                type="email"
                value={form.companyEmail ?? ""}
                onChange={(e) => setForm({ ...form, companyEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("employees.phone")}</Label>
              <Input value={form.companyPhone ?? ""} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Logo URL</Label>
              <Input value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.workStart")} / {t("nav.leave")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t("settings.workStart")}</Label>
              <Input value={form.workStartTime} onChange={(e) => setForm({ ...form, workStartTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.workEnd")}</Label>
              <Input value={form.workEndTime} onChange={(e) => setForm({ ...form, workEndTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.lateThreshold")}</Label>
              <Input value={form.lateThresholdTime} onChange={(e) => setForm({ ...form, lateThresholdTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.annualLeaveDays")}</Label>
              <Input
                type="number"
                value={form.annualLeaveDefault}
                onChange={(e) => setForm({ ...form, annualLeaveDefault: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.currency")}</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.lateDeduction")}</Label>
              <Input
                type="number"
                value={form.lateDeductionPerDay}
                onChange={(e) => setForm({ ...form, lateDeductionPerDay: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? t("common.loading") : t("settings.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
