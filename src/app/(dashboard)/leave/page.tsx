"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Check, X, Ban } from "lucide-react";
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
import { LeaveStatus, LeaveType, LeaveTypeLabels, Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

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
  const role = session?.user?.role;
  const isHR = role === Role.SUPER_ADMIN || role === Role.HR_ADMIN;
  const [tab, setTab] = useState<"mine" | "team" | "all">("mine");
  const [items, setItems] = useState<Leave[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
    if (session?.user?.employeeId) tabs.push({ key: "mine", label: "My Requests" });
    if (role === Role.MANAGER) tabs.push({ key: "team", label: "Team Approvals" });
    if (isHR) tabs.push({ key: "all", label: "All / HR Approvals" });
    return tabs;
  }, [role, isHR, session?.user?.employeeId]);

  async function load() {
    const params = new URLSearchParams();
    params.set("scope", tab);
    params.set("page", String(page));
    const res = await fetch("/api/leave?" + params.toString(), { cache: "no-store" });
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
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Leave request submitted");
    setOpen(false);
    setForm({ type: LeaveType.ANNUAL, startDate: "", endDate: "", reason: "" });
    load();
  }

  async function cancelLeave(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    const res = await fetch(`/api/leave/${id}/cancel`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Leave request cancelled");
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
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success(`Leave ${action === "APPROVE" ? "approved" : "rejected"}`);
    setDecideOpen(null);
    setNote("");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Request and manage leave with multi-level approval"
        actions={
          session?.user?.employeeId && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Request Leave
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
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500">
                    No requests.
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
                    <TableCell>{LeaveTypeLabels[l.type as keyof typeof LeaveTypeLabels]}</TableCell>
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
                      {l.status !== LeaveStatus.REJECTED && l.status !== LeaveStatus.CANCELLED && (
                        (session?.user?.employeeId === l.employee.id || isHR) && (
                          <Button size="sm" variant="ghost" title="Cancel" onClick={() => cancelLeave(l.id)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )
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
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(LeaveTypeLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
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
            <DialogTitle>
              {decideOpen?.action === "APPROVE" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {decideOpen?.leave.employee.fullName} —{" "}
              {decideOpen ? LeaveTypeLabels[decideOpen.leave.type as keyof typeof LeaveTypeLabels] : ""} (
              {decideOpen?.leave.days}d)
            </p>
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

function LeaveBadge({ status }: { status: string }) {
  if (status === LeaveStatus.APPROVED) return <Badge variant="success">Approved</Badge>;
  if (status === LeaveStatus.REJECTED) return <Badge variant="destructive">Rejected</Badge>;
  if (status === LeaveStatus.MANAGER_APPROVED) return <Badge variant="info">Manager OK</Badge>;
  if (status === LeaveStatus.CANCELLED) return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}
