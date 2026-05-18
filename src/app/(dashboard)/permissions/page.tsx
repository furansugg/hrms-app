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
import { PermissionStatus, PermissionType, PermissionTypeLabels, Role } from "@/lib/constants";
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
    if (session?.user?.employeeId) tabs.push({ key: "mine", label: "My Requests" });
    if (role === Role.MANAGER) tabs.push({ key: "team", label: "Team Approvals" });
    if (isHR) tabs.push({ key: "all", label: "All Requests" });
    return tabs;
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
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Permission requested");
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
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success(`Permission ${decideOpen.action.toLowerCase()}d`);
    setDecideOpen(null);
    setNote("");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Permissions"
        description="Late arrival / early leave permission requests"
        actions={
          session?.user?.employeeId && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Request
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
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No requests.
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
                    <TableCell>{PermissionTypeLabels[p.type as keyof typeof PermissionTypeLabels]}</TableCell>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.reason}</TableCell>
                    <TableCell>
                      {p.status === PermissionStatus.APPROVED ? (
                        <Badge variant="success">Approved</Badge>
                      ) : p.status === PermissionStatus.REJECTED ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
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
            <DialogTitle>New Permission Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(PermissionTypeLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!decideOpen} onOpenChange={(v) => !v && setDecideOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideOpen?.action === "APPROVE" ? "Approve" : "Reject"} Permission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecideOpen(null)}>
                Cancel
              </Button>
              <Button onClick={decide} variant={decideOpen?.action === "REJECT" ? "destructive" : "default"}>
                {decideOpen?.action === "APPROVE" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
