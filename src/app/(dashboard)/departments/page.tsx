"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Role } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";

type Dept = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count: { employees: number; positions: number };
};

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const { t } = useT();
  const canManage =
    session?.user?.role === Role.SUPER_ADMIN || session?.user?.role === Role.HR_ADMIN;
  const [items, setItems] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({ code: "", name: "", isActive: true });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/departments", { cache: "no-store" });
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", isActive: true });
    setOpen(true);
  }
  function openEdit(d: Dept) {
    setEditing(d);
    setForm({ code: d.code, name: d.name, isActive: d.isActive });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/departments/${editing.id}` : "/api/departments";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? t("departments.toastFailedSave"));
      return;
    }
    toast.success(editing ? t("departments.toastUpdated") : t("departments.toastCreated"));
    setOpen(false);
    load();
  }
  async function remove(d: Dept) {
    if (!confirm(t("departments.confirmDelete", { name: d.name }))) return;
    const res = await fetch(`/api/departments/${d.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.warning(data.error ?? t("departments.toastFailedDelete"));
    } else {
      toast.success(data.deactivated ? t("departments.toastDeactivated") : t("departments.toastDeleted"));
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("departments.title")}
        description={t("departments.subtitle")}
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("departments.new")}
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
                <TableHead>{t("departments.colEmployees")}</TableHead>
                <TableHead>{t("departments.colPositions")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {canManage && <TableHead className="text-right">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="text-center text-slate-500">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="text-center text-slate-500">
                    {t("departments.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d._count.employees}</TableCell>
                  <TableCell>{d._count.positions}</TableCell>
                  <TableCell>
                    {d.isActive ? <Badge variant="success">{t("common.active")}</Badge> : <Badge variant="secondary">{t("common.inactive")}</Badge>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(d)}>
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
            <DialogTitle>{editing ? t("departments.edit") : t("departments.new")}</DialogTitle>
            <DialogDescription>{t("departments.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("common.code")}</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                placeholder="ENG"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Engineering"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <Label htmlFor="isActive">{t("common.active")}</Label>
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
