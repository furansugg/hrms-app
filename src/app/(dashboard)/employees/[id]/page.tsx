"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleLabels, Role } from "@/lib/constants";

type EmployeeDetail = {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  joinDate: string;
  basicSalary: number;
  annualLeaveBalance: number;
  status: string;
  department: { id: string; name: string; code: string } | null;
  position: { id: string; name: string; code: string } | null;
  supervisor: { id: string; fullName: string } | null;
  user: { id: string; email: string; role: string; isActive: boolean } | null;
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/employees/${params.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setEmp(data);
      })
      .catch(() => setError("Failed to load"));
  }, [params.id]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.push("/employees")}>
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </Button>
      </div>
    );
  }
  if (!emp) return <div className="p-8 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={emp.fullName}
        description={`Employee detail — ${emp.nik}`}
        actions={
          <Button variant="outline" onClick={() => router.push("/employees")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="NIK" value={emp.nik} />
            <Row label="Full Name" value={emp.fullName} />
            <Row label="Email" value={emp.email} />
            <Row label="Phone" value={emp.phone ?? "-"} />
            <Row label="Address" value={emp.address ?? "-"} />
            <Row label="Join Date" value={formatDate(emp.joinDate)} />
            <Row label="Status">
              <Badge variant={emp.status === "ACTIVE" ? "success" : emp.status === "INACTIVE" ? "secondary" : "destructive"}>
                {emp.status}
              </Badge>
            </Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Department" value={emp.department?.name ?? "-"} />
            <Row label="Position" value={emp.position?.name ?? "-"} />
            <Row label="Supervisor" value={emp.supervisor?.fullName ?? "-"} />
            <Row label="Role" value={RoleLabels[(emp.user?.role ?? Role.EMPLOYEE) as Role]} />
            <Row label="Login Active">
              <Badge variant={emp.user?.isActive ? "success" : "secondary"}>
                {emp.user?.isActive ? "Active" : "Disabled"}
              </Badge>
            </Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compensation & Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Basic Salary" value={formatCurrency(emp.basicSalary)} />
            <Row label="Annual Leave Balance" value={String(emp.annualLeaveBalance)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{children ?? value}</span>
    </div>
  );
}
