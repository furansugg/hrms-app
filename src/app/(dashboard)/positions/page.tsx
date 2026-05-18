"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Role } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";

type Pos = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  department: { id: string; name: string } | null;
  _count: { employees: number };
};
type Dept = { id: string; name: string; isActive: boolean };

export default function PositionsPage() {
  const { data: session } = useSession();
  const { t } = useT();
  const canManage = session?.user?.role === Role.SUPER_ADMIN || session?.user?.role === Role.HR_ADMIN;
  const [items, setItems] = useState<Pos[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pos | null>(null);
  const [form, setForm] = useState({ code: "", name: "", departmentId: "", isActive: true });

  async function load() {
    const [p, d] = await Promise.all([
      fetch("/api/positions", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/departments", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setItems(p.items ?? []);
    setDepts(d.items ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", departmentId: "", isActive: true });
    setOpen(true);
  }
  function openEdit(p: Pos) {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      departmentId: p.department?.id ?? "",
      isActive: p.isActive,
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/positions/${editing.id}` : "/api/positions";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        departmentId: form.departmentId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? t("common.failed"));
      return;
    }
    toast.success(editing ? t("positions.toastUpdated") : t("positions.toastCreated"));
    setOpen(false);
    load();
  }
  async function remove(p: Pos) {
    if (!confirm(t("positions.confirmDelete", { name: p.name }))) return;
    const res = await fetch(`/api/positions/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) toast.warning(data.error ?? t("common.failed"));
    else toast.success(data.deactivated ? t("positions.toastDeactivated") : t("positions.toastDeleted"));
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("positions.title")}
        description={t("positions.subtitle")}
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("positions.new")}
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.department")}</TableHead>
                <TableHead>{t("departments.colEmployees")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {canManage && <TableHead className="text-right">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="text-center text-slate-500">
                    {t("positions.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.department?.name ?? t("common.dash")}</TableCell>
                  <TableCell>{p._count.employees}</TableCell>
                  <TableCell>
                    {p.isActive ? <Badge variant="success">{t("common.active")}</Badge> : <Badge variant="secondary">{t("common.inactive")}</Badge>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("positions.edit") : t("positions.new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("common.code")}</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">{t("common.department")}</Label>
              <Select
                id="department"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">{t("common.noneShort")}</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <Label htmlFor="active">{t("common.active")}</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{editing ? t("common.save") : t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
