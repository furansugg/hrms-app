"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { Role, EmployeeStatus } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { formatCurrency } from "@/lib/utils";

type Employee = {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  phone: string | null;
  basicSalary: number;
  status: string;
  department: { id: string; name: string };
  position: { id: string; name: string };
  supervisor: { id: string; fullName: string } | null;
  user: { id: string; email: string; role: string; isActive: boolean } | null;
};

type Option = { id: string; name: string; isActive?: boolean };

export default function EmployeesPage() {
  const { data: session } = useSession();
  const { t } = useT();
  const canManage = session?.user?.role === Role.SUPER_ADMIN || session?.user?.role === Role.HR_ADMIN;
  const [items, setItems] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [depts, setDepts] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    nik: "",
    fullName: "",
    email: "",
    phone: "",
    address: "",
    departmentId: "",
    positionId: "",
    supervisorId: "",
    basicSalary: 0,
    status: EmployeeStatus.ACTIVE as string,
    role: Role.EMPLOYEE as string,
    password: "",
  });

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (departmentFilter) params.set("departmentId", departmentFilter);
    if (statusFilter) params.set("status", statusFilter);
    const [e, d, p] = await Promise.all([
      fetch("/api/employees?" + params.toString(), { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/departments", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/positions", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setItems(e.items ?? []);
    setDepts((d.items ?? []).filter((x: Option) => x.isActive));
    setPositions((p.items ?? []).filter((x: Option) => x.isActive));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setGeneratedPassword(null);
    setForm({
      nik: "",
      fullName: "",
      email: "",
      phone: "",
      address: "",
      departmentId: depts[0]?.id ?? "",
      positionId: positions[0]?.id ?? "",
      supervisorId: "",
      basicSalary: 0,
      status: EmployeeStatus.ACTIVE,
      role: Role.EMPLOYEE,
      password: "",
    });
    setOpen(true);
  }
  function openEdit(emp: Employee) {
    setEditing(emp);
    setGeneratedPassword(null);
    setForm({
      nik: emp.nik,
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone ?? "",
      address: "",
      departmentId: emp.department.id,
      positionId: emp.position.id,
      supervisorId: emp.supervisor?.id ?? "",
      basicSalary: emp.basicSalary,
      status: emp.status,
      role: emp.user?.role ?? Role.EMPLOYEE,
      password: "",
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/employees/${editing.id}` : "/api/employees";
    const method = editing ? "PUT" : "POST";
    const payload: Record<string, unknown> = {
      ...form,
      basicSalary: Number(form.basicSalary),
      supervisorId: form.supervisorId || null,
    };
    if (!form.password) delete payload.password;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? t("common.failed"));
      return;
    }
    toast.success(editing ? t("employees.toastUpdated") : t("employees.toastCreated"));
    if (!editing && data.generatedPassword) {
      setGeneratedPassword(data.generatedPassword);
    } else {
      setOpen(false);
    }
    load();
  }
  async function remove(emp: Employee) {
    if (!confirm(t("employees.confirmTerminate", { name: emp.fullName }))) return;
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? t("common.failed"));
    } else {
      toast.success(t("employees.toastTerminated"));
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("employees.title")}
        description={t("employees.subtitle")}
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("employees.new")}
            </Button>
          )
        }
      />
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={t("employees.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">{t("common.allDepartments")}</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("common.allStatuses")}</option>
            <option value="ACTIVE">{t("employeeStatus.ACTIVE")}</option>
            <option value="INACTIVE">{t("employeeStatus.INACTIVE")}</option>
            <option value="TERMINATED">{t("employeeStatus.TERMINATED")}</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employees.colNIK")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.email")}</TableHead>
                <TableHead>{t("common.department")}</TableHead>
                <TableHead>{t("common.position")}</TableHead>
                <TableHead>{t("employees.colSalary")}</TableHead>
                <TableHead>{t("common.role")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {canManage && <TableHead className="text-right">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8} className="text-center text-slate-500">
                    {t("employees.none")}
                  </TableCell>
                </TableRow>
              )}
              {items.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono text-xs">{emp.nik}</TableCell>
                  <TableCell className="font-medium">{emp.fullName}</TableCell>
                  <TableCell className="text-slate-600">{emp.email}</TableCell>
                  <TableCell>{emp.department.name}</TableCell>
                  <TableCell>{emp.position.name}</TableCell>
                  <TableCell>{formatCurrency(emp.basicSalary)}</TableCell>
                  <TableCell>
                    <Badge variant="info">{t(`role.${emp.user?.role ?? Role.EMPLOYEE}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    {emp.status === "ACTIVE" ? (
                      <Badge variant="success">{t("employeeStatus.ACTIVE")}</Badge>
                    ) : emp.status === "INACTIVE" ? (
                      <Badge variant="secondary">{t("employeeStatus.INACTIVE")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("employeeStatus.TERMINATED")}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(emp)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("employees.edit") : t("employees.new")}</DialogTitle>
          </DialogHeader>
          {generatedPassword ? (
            <div className="space-y-3">
              <p className="text-sm">{t("employees.credentialsHeader")}</p>
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div>
                  <b>{t("common.email")}:</b> {form.email}
                </div>
                <div>
                  <b>{t("login.password")}:</b> <span className="font-mono">{generatedPassword}</span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>{t("common.done")}</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("employees.colNIK")}>
                <Input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} required />
              </Field>
              <Field label={t("employees.fullName")}>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </Field>
              <Field label={t("common.email")}>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label={t("employees.phone")}>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label={t("common.department")}>
                <Select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  required
                >
                  <option value="">{t("common.select")}</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("common.position")}>
                <Select
                  value={form.positionId}
                  onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                  required
                >
                  <option value="">{t("common.select")}</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("employees.supervisor")}>
                <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                  <option value="">{t("common.none")}</option>
                  {items
                    .filter((e) => e.id !== editing?.id && e.status === "ACTIVE")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t("employees.basicSalary")}>
                <Input
                  type="number"
                  min={0}
                  value={form.basicSalary}
                  onChange={(e) => setForm({ ...form, basicSalary: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("common.role")}>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value={Role.EMPLOYEE}>{t("role.EMPLOYEE")}</option>
                  <option value={Role.MANAGER}>{t("role.MANAGER")}</option>
                  <option value={Role.HR_ADMIN}>{t("role.HR_ADMIN")}</option>
                  <option value={Role.SUPER_ADMIN}>{t("role.SUPER_ADMIN")}</option>
                </Select>
              </Field>
              <Field label={t("common.status")}>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value={EmployeeStatus.ACTIVE}>{t("employeeStatus.ACTIVE")}</option>
                  <option value={EmployeeStatus.INACTIVE}>{t("employeeStatus.INACTIVE")}</option>
                  <option value={EmployeeStatus.TERMINATED}>{t("employeeStatus.TERMINATED")}</option>
                </Select>
              </Field>
              <Field label={editing ? t("employees.passwordEditLabel") : t("employees.passwordCreateLabel")} full>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? t("employees.passwordEditPlaceholder") : t("employees.passwordCreatePlaceholder")}
                />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{editing ? t("common.save") : t("common.create")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={"space-y-2 " + (full ? "sm:col-span-2" : "")}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
