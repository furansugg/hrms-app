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
import { LeaveStatus, LeaveType, Role } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";

type Leave = {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  managerNote: string | null;
  hrNote: string | null;
  employee: {
    id: string;
    fullName: string;
    supervisorId: string | null;
    supervisor: { id: string; userId: string | null } | null;
  };
};

export default function LeavePage() {
  const { data: session } = useSession();
  const { t } = useT();
  const role = session?.user?.role;
  const isHR = role === Role.SUPER_ADMIN || role === Role.HR_ADMIN;
  const [tab, setTab] = useState<"mine" | "team" | "all">("mine");
  const [items, setItems] = useState<Leave[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: LeaveType.ANNUAL as string,
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [decideOpen, setDecideOpen] = useState<{ leave: Leave; action: "APPROVE" | "REJECT"; stage: "manager" | "hr" } | null>(null);
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
    const res = await fetch("/api/leave?" + params.toString(), { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
  }
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.find((t) => t.key === tab)) setTab(availableTabs[0].key);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, availableTabs.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("leave.toastCreated"));
    setOpen(false);
    setForm({ type: LeaveType.ANNUAL, startDate: "", endDate: "", reason: "" });
    load();
  }

  async function decide() {
    if (!decideOpen) return;
    const { leave, action, stage } = decideOpen;
    const res = await fetch(`/api/leave/${leave.id}/decision?stage=${stage}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: action, note }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("leave.toastDecided"));
    setDecideOpen(null);
    setNote("");
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("leave.title")}
        description={t("leave.subtitle")}
        actions={
          session?.user?.employeeId && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {t("leave.new")}
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {availableTabs.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("leave.colEmployee")}</TableHead>
                <TableHead>{t("leave.colType")}</TableHead>
                <TableHead>{t("common.from")}</TableHead>
                <TableHead>{t("common.to")}</TableHead>
                <TableHead>{t("leave.colDays")}</TableHead>
                <TableHead>{t("leave.colReason")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500">
                    {t("leave.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((l) => {
                const canManagerAct =
                  l.status === LeaveStatus.PENDING &&
                  role === Role.MANAGER &&
                  session?.user?.employeeId === l.employee.supervisorId;
                const canHrAct =
                  isHR &&
                  (l.status === LeaveStatus.MANAGER_APPROVED ||
                    (l.status === LeaveStatus.PENDING && !l.employee.supervisorId));
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.employee.fullName}</TableCell>
                    <TableCell>{t(`leaveType.${l.type}`)}</TableCell>
                    <TableCell>{formatDate(l.startDate)}</TableCell>
                    <TableCell>{formatDate(l.endDate)}</TableCell>
                    <TableCell>{l.days}</TableCell>
                    <TableCell className="max-w-xs truncate">{l.reason}</TableCell>
                    <TableCell>
                      <LeaveBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManagerAct && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ leave: l, action: "APPROVE", stage: "manager" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ leave: l, action: "REJECT", stage: "manager" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canHrAct && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ leave: l, action: "APPROVE", stage: "hr" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDecideOpen({ leave: l, action: "REJECT", stage: "hr" })}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leave.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("leave.fieldType")}</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value={LeaveType.ANNUAL}>{t("leaveType.ANNUAL")}</option>
                <option value={LeaveType.SICK}>{t("leaveType.SICK")}</option>
                <option value={LeaveType.EMERGENCY}>{t("leaveType.EMERGENCY")}</option>
                <option value={LeaveType.UNPAID}>{t("leaveType.UNPAID")}</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.from")}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{t("common.to")}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("leave.fieldReason")}</Label>
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
            <DialogTitle>
              {decideOpen?.stage === "manager"
                ? decideOpen?.action === "APPROVE"
                  ? t("leave.approveManager")
                  : t("leave.rejectManager")
                : decideOpen?.action === "APPROVE"
                ? t("leave.approveHR")
                : t("leave.rejectHR")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {decideOpen?.leave.employee.fullName} —{" "}
              {decideOpen ? t(`leaveType.${decideOpen.leave.type}`) : ""} (
              {decideOpen?.leave.days} {t("common.daysSuffix")})
            </p>
            <div className="space-y-2">
              <Label>{t("common.note")} ({t("common.optional")})</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecideOpen(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={decide} variant={decideOpen?.action === "REJECT" ? "destructive" : "default"}>
                {decideOpen?.action === "APPROVE" ? t("leaveStatus.APPROVED") : t("leaveStatus.REJECTED")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveBadge({ status }: { status: string }) {
  const { t } = useT();
  if (status === LeaveStatus.APPROVED) return <Badge variant="success">{t("leaveStatus.APPROVED")}</Badge>;
  if (status === LeaveStatus.REJECTED) return <Badge variant="destructive">{t("leaveStatus.REJECTED")}</Badge>;
  if (status === LeaveStatus.MANAGER_APPROVED) return <Badge variant="info">{t("leaveStatus.MANAGER_APPROVED")}</Badge>;
  if (status === LeaveStatus.CANCELLED) return <Badge variant="secondary">{t("leaveStatus.CANCELLED")}</Badge>;
  return <Badge variant="warning">{t("leaveStatus.PENDING")}</Badge>;
}
