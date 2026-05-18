"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Role } from "@/lib/constants";
import { formatCurrency, getCurrentPeriod } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type Payroll = {
  id: string;
  period: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  lateDays: number;
  unpaidLeaveDays: number;
  netSalary: number;
  employee: {
    id: string;
    fullName: string;
    nik: string;
    department: { name: string };
    position: { name: string };
  };
};

export default function PayrollPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canGenerate = role === Role.SUPER_ADMIN || role === Role.HR_ADMIN;
  const [items, setItems] = useState<Payroll[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ period: getCurrentPeriod(), defaultAllowances: 0 });

  async function load() {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    params.set("page", String(page));
    const res = await fetch("/api/payroll?" + params.toString(), { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, page]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/payroll/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: form.period, defaultAllowances: Number(form.defaultAllowances) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success(`Generated ${d.generated} payrolls (${d.duplicate} duplicates, ${d.errors} errors)`);
    setOpen(false);
    setPeriod(form.period);
  }

  const total = useMemo(() => items.reduce((s, p) => s + p.netSalary, 0), [items]);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Monthly payroll generation and payslips"
        actions={
          canGenerate && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Generate
            </Button>
          )
        }
      />
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label>Period</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="text-sm text-slate-600 sm:col-span-2 sm:text-right">
            Total Net: <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Unpaid</TableHead>
                <TableHead>Net</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-500">
                    No payroll for this period.
                  </TableCell>
                </TableRow>
              )}
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.employee.fullName}
                    <div className="text-xs text-slate-500 font-mono">{p.employee.nik}</div>
                  </TableCell>
                  <TableCell>{p.employee.department.name}</TableCell>
                  <TableCell>{p.employee.position.name}</TableCell>
                  <TableCell>{formatCurrency(p.basicSalary)}</TableCell>
                  <TableCell>{formatCurrency(p.allowances)}</TableCell>
                  <TableCell className="text-red-600">- {formatCurrency(p.deductions)}</TableCell>
                  <TableCell>{p.lateDays}</TableCell>
                  <TableCell>{p.unpaidLeaveDays}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(p.netSalary)}</TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/api/payroll/${p.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 text-sm hover:underline"
                    >
                      <Download className="h-4 w-4" /> PDF
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
          </DialogHeader>
          <form onSubmit={generate} className="space-y-4">
            <div className="space-y-2">
              <Label>Period</Label>
              <Input
                type="month"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Default Allowances (per employee)</Label>
              <Input
                type="number"
                min={0}
                value={form.defaultAllowances}
                onChange={(e) => setForm({ ...form, defaultAllowances: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Generate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
