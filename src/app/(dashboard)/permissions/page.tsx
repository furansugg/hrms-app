"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { PermissionStatus, PermissionType, Role } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type Perm = {
  id: string;
  type: string;
  status: string;
  date: string;
  reason: string;
  managerNote: string | null;
  employee: { id: string; fullName: string; supervisorId: string | null };
};

export default function PermissionsPage() {
  const { data: session } = useSession();
  const { t } = useT();
  const role = session?.user?.role;
  const isHR = role === Role.SUPER_ADMIN || role === Role.HR_ADMIN;
  const [tab, setTab] = useState<"mine" | "team" | "all">("mine");
  const [items, setItems] = useState<Perm[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: PermissionType.LATE_ARRIVAL as string, date: "", reason: "" });
  const [decideOpen, setDecideOpen] = useState<{ p: Perm; action: "APPROVE" | "REJECT" } | null>(null);
  const [note, setNote] = useState("");

  const availableTabs = useMemo(() => {
    const tabs: { key: "mine" | "team" | "all"; label: string }[] = [];
    if (session?.user?.employeeId) tabs.push({ key: "mine", label: t("leave.scopeMine") });
    if (role === Role.MANAGER) tabs.push({ key: "team", label: t("leave.scopeTeam") });
    if (isHR) tabs.push({ key: "all", label: t("leave.scopeAll") });
    return tabs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isHR, session?.user?.employeeId]);

  async function load() {
    const params = new URLSearchParams();
    params.set("scope", tab);
    params.set("page", String(page));
    const res = await fetch("/api/permission?" + params.toString(), { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
  }
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.find((t) => t.key === tab)) setTab(availableTabs[0].key);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, availableTabs.length, page]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("permissions.toastCreated"));
    setOpen(false);
    setForm({ type: PermissionType.LATE_ARRIVAL, date: "", reason: "" });
    load();
  }
  async function decide() {
    if (!decideOpen) return;
    const res = await fetch(`/api/permission/${decideOpen.p.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: decideOpen.action, note }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("permissions.toastDecided"));
    setDecideOpen(null);
    setNote("");
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("permissions.title")}
        description={t("permissions.subtitle")}
        actions={
          session?.user?.employeeId && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {t("permissions.new")}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {availableTabs.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("permissions.colEmployee")}</TableHead>
                <TableHead>{t("permissions.colType")}</TableHead>
                <TableHead>{t("permissions.colDate")}</TableHead>
                <TableHead>{t("permissions.colReason")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    {t("permissions.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((p) => {
                const canManagerAct =
                  p.status === PermissionStatus.PENDING &&
                  ((role === Role.MANAGER && session?.user?.employeeId === p.employee.supervisorId) || isHR);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee.fullName}</TableCell>
                    <TableCell>{t(`permissionType.${p.type}`)}</TableCell>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.reason}</TableCell>
                    <TableCell>
                      {p.status === PermissionStatus.APPROVED ? (
                        <Badge variant="success">{t("permissionStatus.APPROVED")}</Badge>
                      ) : p.status === PermissionStatus.REJECTED ? (
                        <Badge variant="destructive">{t("permissionStatus.REJECTED")}</Badge>
                      ) : (
                        <Badge variant="warning">{t("permissionStatus.PENDING")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManagerAct && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ p, action: "APPROVE" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ p, action: "REJECT" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("permissions.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("permissions.fieldType")}</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value={PermissionType.LATE_ARRIVAL}>{t("permissionType.LATE_ARRIVAL")}</option>
                <option value={PermissionType.EARLY_LEAVE}>{t("permissionType.EARLY_LEAVE")}</option>
                <option value={PermissionType.OUT_OF_OFFICE}>{t("permissionType.OUT_OF_OFFICE")}</option>
                <option value={PermissionType.OTHER}>{t("permissionType.OTHER")}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("permissions.fieldDate")}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("permissions.fieldReason")}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!decideOpen} onOpenChange={(v) => !v && setDecideOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideOpen?.action === "APPROVE" ? t("permissions.approve") : t("permissions.reject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("common.note")} ({t("common.optional")})</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecideOpen(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={decide} variant={decideOpen?.action === "REJECT" ? "destructive" : "default"}>
                {decideOpen?.action === "APPROVE" ? t("permissions.approve") : t("permissions.reject")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
