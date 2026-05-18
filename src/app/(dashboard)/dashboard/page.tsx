import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, CalendarDays, Wallet, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { Role, LeaveStatus } from "@/lib/constants";
import { getServerT } from "@/lib/i18n/server";
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
  const { t } = getServerT();
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-slate-500">{t("dashboard.overview")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t("dashboard.statActive")} value={String(employees)} />
        <StatCard icon={Building2} label={t("dashboard.statDepts")} value={String(depts)} />
        <StatCard icon={CalendarDays} label={t("dashboard.statPendingLeaves")} value={String(leavesPending)} />
        <StatCard icon={Wallet} label={t("dashboard.statTotalPayroll")} value={formatCurrency(payroll._sum.netSalary ?? 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentLeaves")}</CardTitle>
            <CardDescription>{t("dashboard.recentLeavesSub")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeaves.length === 0 && <p className="text-sm text-slate-500">{t("dashboard.noRequests")}</p>}
            {recentLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{l.employee.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {t(`leaveType.${l.type}`)} ·{" "}
                    {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.days} {t("common.daysSuffix")})
                  </div>
                </div>
                <LeaveBadge status={l.status} />
              </div>
            ))}
            <Link href="/leave" className="inline-block text-xs text-emerald-700 hover:underline">{t("dashboard.viewAll")}</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentAttendance")}</CardTitle>
            <CardDescription>{t("dashboard.recentAttendanceSub")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAttendance.length === 0 && <p className="text-sm text-slate-500">{t("dashboard.noAttendance")}</p>}
            {recentAttendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{a.employee.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(a.date)} ·{" "}
                    {t("dashboard.attendanceInOut", {
                      in: a.checkInAt ? formatDate(a.checkInAt, true).slice(11) : t("common.dash"),
                      out: a.checkOutAt ? formatDate(a.checkOutAt, true).slice(11) : t("common.dash"),
                    })}
                  </div>
                </div>
                <AttendanceBadge status={a.status} />
              </div>
            ))}
            <Link href="/attendance" className="inline-block text-xs text-emerald-700 hover:underline">{t("dashboard.viewAll")}</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function ManagerDashboard({ userId }: { userId: string }) {
  const { t } = getServerT();
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
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.managerTitle")}</h1>
        <p className="text-sm text-slate-500">{t("dashboard.welcome", { name: manager?.employee?.fullName ?? manager?.email ?? "" })}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label={t("dashboard.teamMembers")} value={String(subordinates.length)} />
        <StatCard icon={CalendarDays} label={t("dashboard.pendingLeaveApprovals")} value={String(pendingLeaves)} />
        <StatCard icon={Clock} label={t("dashboard.pendingPermissions")} value={String(pendingPerms)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.yourTeam")}</CardTitle>
        </CardHeader>
        <CardContent>
          {subordinates.length === 0 && <p className="text-sm text-slate-500">{t("dashboard.noReports")}</p>}
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
  const { t } = getServerT();
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
          {t("dashboard.welcome", { name: user?.employee?.fullName ?? user?.email ?? "" })}
        </h1>
        <p className="text-sm text-slate-500">
          {user?.employee?.position?.name} · {user?.employee?.department?.name} · {t(`role.${user?.role}`)}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          label={t("dashboard.todayCheckin")}
          value={todayAttendance?.checkInAt ? formatDate(todayAttendance.checkInAt, true).slice(11) : t("dashboard.notYet")}
        />
        <StatCard
          icon={Clock}
          label={t("dashboard.todayCheckout")}
          value={todayAttendance?.checkOutAt ? formatDate(todayAttendance.checkOutAt, true).slice(11) : t("dashboard.notYet")}
        />
        <StatCard
          icon={CalendarDays}
          label={t("dashboard.annualBalance")}
          value={`${user?.employee?.annualLeaveBalance ?? 0} ${t("common.daysSuffix")}`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.yourRecentLeaves")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentLeaves.length === 0 && <p className="text-sm text-slate-500">{t("dashboard.noRequests")}</p>}
          {recentLeaves.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {t(`leaveType.${l.type}`)}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.days} {t("common.daysSuffix")})
                </div>
              </div>
              <LeaveBadge status={l.status} />
            </div>
          ))}
          <Link href="/leave" className="inline-block text-xs text-emerald-700 hover:underline">{t("dashboard.requestLeave")}</Link>
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
  const { t } = getServerT();
  if (status === LeaveStatus.APPROVED) return <Badge variant="success">{t("leaveStatus.APPROVED")}</Badge>;
  if (status === LeaveStatus.REJECTED) return <Badge variant="destructive">{t("leaveStatus.REJECTED")}</Badge>;
  if (status === LeaveStatus.MANAGER_APPROVED) return <Badge variant="info">{t("leaveStatus.MANAGER_APPROVED")}</Badge>;
  if (status === LeaveStatus.CANCELLED) return <Badge variant="secondary">{t("leaveStatus.CANCELLED")}</Badge>;
  return <Badge variant="warning">{t("leaveStatus.PENDING")}</Badge>;
}

function AttendanceBadge({ status }: { status: string }) {
  const { t } = getServerT();
  if (status === "LATE") return <Badge variant="warning">{t("attendanceStatus.LATE")}</Badge>;
  if (status === "ABSENT") return <Badge variant="destructive">{t("attendanceStatus.ABSENT")}</Badge>;
  return <Badge variant="success">{t("attendanceStatus.PRESENT")}</Badge>;
}
