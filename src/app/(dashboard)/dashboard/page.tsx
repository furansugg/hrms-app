import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, CalendarDays, Wallet, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { Role, LeaveStatus, RoleLabels, LeaveTypeLabels } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const role = session.user.role;

  if (role === Role.EMPLOYEE) return <EmployeeDashboard userId={session.user.id} />;
  if (role === Role.MANAGER) return <ManagerDashboard userId={session.user.id} />;
  return <AdminDashboard />;
}

async function AdminDashboard() {
  const [employees, depts, leavesPending, payroll] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.leaveRequest.count({ where: { status: { in: [LeaveStatus.PENDING, LeaveStatus.MANAGER_APPROVED] } } }),
    prisma.payroll.aggregate({ _sum: { netSalary: true } }),
  ]);
  const recentLeaves = await prisma.leaveRequest.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { fullName: true } } },
  });
  const recentAttendance = await prisma.attendance.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { fullName: true } } },
  });

  const deptData = await prisma.department.findMany({
    where: { isActive: true },
    select: { name: true, _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
    take: 10,
  });
  const deptMax = Math.max(1, ...deptData.map((d) => d._count.employees));

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthlyLeaves = await prisma.leaveRequest.groupBy({
    by: ["status"],
    where: { createdAt: { gte: sixMonthsAgo } },
    _count: true,
  });
  const leaveByStatus = monthlyLeaves.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = r._count;
    return acc;
  }, {});
  const leaveStatusMax = Math.max(1, ...Object.values(leaveByStatus));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of company HR activities</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Employees" value={String(employees)} />
        <StatCard icon={Building2} label="Departments" value={String(depts)} />
        <StatCard icon={CalendarDays} label="Pending Leaves" value={String(leavesPending)} />
        <StatCard icon={Wallet} label="Total Payroll" value={formatCurrency(payroll._sum.netSalary ?? 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Employees by Department</CardTitle>
            <CardDescription>Active departments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {deptData.map((d) => (
              <div key={d.name} className="flex items-center gap-3 text-sm">
                <span className="w-24 truncate text-slate-600">{d.name}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-sm"
                    style={{ width: `${(d._count.employees / deptMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium">{d._count.employees}</span>
              </div>
            ))}
            {deptData.length === 0 && <p className="text-sm text-slate-500">No data.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests by Status</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(leaveByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate text-slate-600">{status.replace(/_/g, " ")}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-sm"
                    style={{ width: `${(count / leaveStatusMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(leaveByStatus).length === 0 && <p className="text-sm text-slate-500">No data.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Leave Requests</CardTitle>
            <CardDescription>Latest leave submissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeaves.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
            {recentLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{l.employee.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {LeaveTypeLabels[l.type as keyof typeof LeaveTypeLabels]} ·{" "}
                    {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.days}d)
                  </div>
                </div>
                <LeaveBadge status={l.status} />
              </div>
            ))}
            <Link href="/leave" className="inline-block text-xs text-emerald-700 hover:underline">View all →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Latest check-ins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAttendance.length === 0 && <p className="text-sm text-slate-500">No attendance yet.</p>}
            {recentAttendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{a.employee.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(a.date)} · in {a.checkInAt ? formatDate(a.checkInAt, true).slice(11) : "-"} · out{" "}
                    {a.checkOutAt ? formatDate(a.checkOutAt, true).slice(11) : "-"}
                  </div>
                </div>
                <AttendanceBadge status={a.status} />
              </div>
            ))}
            <Link href="/attendance" className="inline-block text-xs text-emerald-700 hover:underline">View all →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function ManagerDashboard({ userId }: { userId: string }) {
  const manager = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
  const subordinates = manager?.employee
    ? await prisma.employee.findMany({
        where: { supervisorId: manager.employee.id },
        select: { id: true, fullName: true, position: { select: { name: true } } },
      })
    : [];
  const subIds = subordinates.map((s) => s.id);
  const pendingLeaves = await prisma.leaveRequest.count({
    where: { employeeId: { in: subIds }, status: LeaveStatus.PENDING },
  });
  const pendingPerms = await prisma.permissionRequest.count({
    where: { employeeId: { in: subIds }, status: "PENDING" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome, {manager?.employee?.fullName ?? manager?.email}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Team Members" value={String(subordinates.length)} />
        <StatCard icon={CalendarDays} label="Pending Leave Approvals" value={String(pendingLeaves)} />
        <StatCard icon={Clock} label="Pending Permissions" value={String(pendingPerms)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your team</CardTitle>
        </CardHeader>
        <CardContent>
          {subordinates.length === 0 && <p className="text-sm text-slate-500">No direct reports.</p>}
          <ul className="space-y-2">
            {subordinates.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{s.fullName}</span>
                <span className="text-xs text-slate-500">{s.position.name}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

async function EmployeeDashboard({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: {
          department: true,
          position: true,
        },
      },
    },
  });
  const employeeId = user?.employee?.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayAttendance = employeeId
    ? await prisma.attendance.findFirst({
        where: { employeeId, date: { gte: todayStart, lte: todayEnd } },
      })
    : null;
  const recentLeaves = employeeId
    ? await prisma.leaveRequest.findMany({
        where: { employeeId },
        take: 5,
        orderBy: { createdAt: "desc" },
      })
    : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {user?.employee?.fullName ?? user?.email}
        </h1>
        <p className="text-sm text-slate-500">
          {user?.employee?.position?.name} · {user?.employee?.department?.name} · {RoleLabels[user?.role as Role]}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          label="Today's Check-in"
          value={todayAttendance?.checkInAt ? formatDate(todayAttendance.checkInAt, true).slice(11) : "Not yet"}
        />
        <StatCard
          icon={Clock}
          label="Today's Check-out"
          value={todayAttendance?.checkOutAt ? formatDate(todayAttendance.checkOutAt, true).slice(11) : "Not yet"}
        />
        <StatCard
          icon={CalendarDays}
          label="Annual Leave Balance"
          value={`${user?.employee?.annualLeaveBalance ?? 0} days`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Recent Leave Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentLeaves.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
          {recentLeaves.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {LeaveTypeLabels[l.type as keyof typeof LeaveTypeLabels]}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.days}d)
                </div>
              </div>
              <LeaveBadge status={l.status} />
            </div>
          ))}
          <Link href="/leave" className="inline-block text-xs text-emerald-700 hover:underline">Request leave →</Link>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaveBadge({ status }: { status: string }) {
  if (status === LeaveStatus.APPROVED) return <Badge variant="success">Approved</Badge>;
  if (status === LeaveStatus.REJECTED) return <Badge variant="destructive">Rejected</Badge>;
  if (status === LeaveStatus.MANAGER_APPROVED) return <Badge variant="info">Manager OK</Badge>;
  if (status === LeaveStatus.CANCELLED) return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

function AttendanceBadge({ status }: { status: string }) {
  if (status === "LATE") return <Badge variant="warning">Late</Badge>;
  if (status === "ABSENT") return <Badge variant="destructive">Absent</Badge>;
  return <Badge variant="success">Present</Badge>;
}
