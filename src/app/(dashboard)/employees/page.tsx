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
import { Role, RoleLabels, EmployeeStatus } from "@/lib/constants";
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
      toast.error(data.error ?? "Failed");
      return;
    }
    toast.success(editing ? "Employee updated" : "Employee created");
    if (!editing && data.generatedPassword) {
      setGeneratedPassword(data.generatedPassword);
    } else {
      setOpen(false);
    }
    load();
  }
  async function remove(emp: Employee) {
    if (!confirm(`Terminate employee "${emp.fullName}"? Their login will be disabled.`)) return;
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Failed");
    } else {
      toast.success("Employee terminated");
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee profiles and access"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Employee
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
              placeholder="Search NIK, name, email…"
              className="pl-9"
            />
          </div>
          <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIK</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8} className="text-center text-slate-500">
                    No employees.
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
                    <Badge variant="info">{RoleLabels[(emp.user?.role ?? Role.EMPLOYEE) as Role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {emp.status === "ACTIVE" ? (
                      <Badge variant="success">Active</Badge>
                    ) : emp.status === "INACTIVE" ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : (
                      <Badge variant="destructive">Terminated</Badge>
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
            <DialogTitle>{editing ? "Edit Employee" : "New Employee"}</DialogTitle>
          </DialogHeader>
          {generatedPassword ? (
            <div className="space-y-3">
              <p className="text-sm">
                Employee account created. Share these credentials with the employee:
              </p>
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div>
                  <b>Email:</b> {form.email}
                </div>
                <div>
                  <b>Password:</b> <span className="font-mono">{generatedPassword}</span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="NIK">
                <Input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} required />
              </Field>
              <Field label="Full Name">
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Department">
                <Select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  required
                >
                  <option value="">— select —</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Position">
                <Select
                  value={form.positionId}
                  onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                  required
                >
                  <option value="">— select —</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Supervisor">
                <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                  <option value="">— none —</option>
                  {items
                    .filter((e) => e.id !== editing?.id && e.status === "ACTIVE")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Basic Salary">
                <Input
                  type="number"
                  min={0}
                  value={form.basicSalary}
                  onChange={(e) => setForm({ ...form, basicSalary: Number(e.target.value) })}
                />
              </Field>
              <Field label="Role">
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value={Role.EMPLOYEE}>Employee</option>
                  <option value={Role.MANAGER}>Manager</option>
                  <option value={Role.HR_ADMIN}>HR Admin</option>
                  <option value={Role.SUPER_ADMIN}>Super Admin</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value={EmployeeStatus.ACTIVE}>Active</option>
                  <option value={EmployeeStatus.INACTIVE}>Inactive</option>
                  <option value={EmployeeStatus.TERMINATED}>Terminated</option>
                </Select>
              </Field>
              <Field label={editing ? "New Password (optional)" : "Password (optional, auto-generated if blank)"} full>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? "Leave blank to keep current" : "Leave blank to auto-generate"}
                />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editing ? "Save" : "Create"}</Button>
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
