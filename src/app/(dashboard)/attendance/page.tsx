"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Role } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type Attendance = {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  employee: { id: string; fullName: string; nik: string };
};

export default function AttendancePage() {
  const { data: session } = useSession();
  const { t } = useT();
  const role = session?.user?.role;
  const isEmployee = role === Role.EMPLOYEE || role === Role.MANAGER;
  const [items, setItems] = useState<Attendance[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      const res = await fetch("/api/attendance?" + params.toString(), { cache: "no-store" });
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function checkIn() {
    const res = await fetch("/api/attendance/check-in", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(d.isLate ? `${t("attendance.checkedIn")} — ${t("attendanceStatus.LATE")}` : t("attendance.checkedIn"));
    load();
  }
  async function checkOut() {
    const res = await fetch("/api/attendance/check-out", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? t("common.failed"));
    toast.success(t("attendance.checkedOut"));
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("attendance.title")}
        description={t("attendance.subtitle")}
        actions={
          isEmployee && session?.user?.employeeId
            ? (
                <div className="flex gap-2">
                  <Button onClick={checkIn}>
                    <LogIn className="h-4 w-4" /> {t("attendance.checkIn")}
                  </Button>
                  <Button variant="secondary" onClick={checkOut}>
                    <LogOut className="h-4 w-4" /> {t("attendance.checkOut")}
                  </Button>
                </div>
              )
            : null
        }
      />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t("attendance.history")}</CardTitle>
          <CardDescription>{t("attendance.lateNotice", { threshold: "08:15" })}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>{t("common.from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4" /> {t("common.search")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("attendance.colDate")}</TableHead>
                <TableHead>{t("attendance.colEmployee")}</TableHead>
                <TableHead>{t("attendance.colCheckIn")}</TableHead>
                <TableHead>{t("attendance.colCheckOut")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {t("attendance.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDate(a.date)}</TableCell>
                  <TableCell className="font-medium">
                    {a.employee.fullName}
                    <div className="text-xs text-slate-500 font-mono">{a.employee.nik}</div>
                  </TableCell>
                  <TableCell>{a.checkInAt ? formatDate(a.checkInAt, true).slice(11) : t("common.dash")}</TableCell>
                  <TableCell>{a.checkOutAt ? formatDate(a.checkOutAt, true).slice(11) : t("common.dash")}</TableCell>
                  <TableCell>
                    {a.status === "LATE" ? (
                      <Badge variant="warning">{t("attendanceStatus.LATE")}</Badge>
                    ) : a.status === "ABSENT" ? (
                      <Badge variant="destructive">{t("attendanceStatus.ABSENT")}</Badge>
                    ) : (
                      <Badge variant="success">{t("attendanceStatus.PRESENT")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
