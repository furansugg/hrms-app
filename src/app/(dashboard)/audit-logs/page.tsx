"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/utils";

type Log = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string; role: string } | null;
};

const ENTITIES = ["Employee", "Department", "Position", "Attendance", "LeaveRequest", "PermissionRequest", "Payroll", "Settings", "Report"];

export default function AuditLogsPage() {
  const [items, setItems] = useState<Log[]>([]);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    const res = await fetch("/api/audit-logs?" + params.toString(), { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Audit Logs" description="Trace data changes (who, what, when, IP)" />
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <Label>Entity</Label>
            <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">All</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. CREATE, APPROVE_LEAVE_HR" />
          </div>
          <Button onClick={load} variant="outline">
            Apply
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No logs.
                  </TableCell>
                </TableRow>
              )}
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(l.createdAt, true)}</TableCell>
                  <TableCell>
                    {l.user?.email ?? "system"}
                    {l.user?.role && <div className="text-xs text-slate-500">{l.user.role}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell>{l.entity}</TableCell>
                  <TableCell className="font-mono text-xs">{l.entityId ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ipAddress ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
