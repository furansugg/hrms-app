import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { leaveSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { diffBusinessDays } from "@/lib/utils";
import { LeaveType, LeaveStatus, Role, NotificationType, LeaveTypeLabels } from "@/lib/constants";
import { notify, notifyRoles } from "@/lib/notifications";
import { getAccessibleEmployeeIds } from "@/lib/employee";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const scope = searchParams.get("scope"); // mine | team | all

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const access = await getAccessibleEmployeeIds({
      id: session.user.id,
      role: session.user.role,
      employeeId: session.user.employeeId,
    });

    if (scope === "mine" && session.user.employeeId) {
      where.employeeId = session.user.employeeId;
    } else if (scope === "team") {
      if (session.user.role === Role.MANAGER && session.user.employeeId) {
        const subs = await prisma.employee.findMany({
          where: { supervisorId: session.user.employeeId },
          select: { id: true },
        });
        where.employeeId = { in: subs.map((s) => s.id) };
      }
    } else if (employeeId) {
      if (!access.all && !access.ids.includes(employeeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      where.employeeId = employeeId;
    } else if (!access.all) {
      where.employeeId = { in: access.ids };
    }

    const items = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            supervisorId: true,
            department: { select: { name: true } },
            supervisor: { select: { id: true, fullName: true, userId: true } },
          },
        },
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.employeeId) {
      return NextResponse.json({ error: "No employee profile" }, { status: 400 });
    }
    const data = leaveSchema.parse(await req.json());
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }
    if (end < start) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    const days = diffBusinessDays(start, end);

    const employee = await prisma.employee.findUnique({ where: { id: session.user.employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    if (data.type === LeaveType.ANNUAL && employee.annualLeaveBalance < days) {
      return NextResponse.json(
        { error: `Insufficient annual leave balance (have ${employee.annualLeaveBalance}, need ${days})` },
        { status: 400 }
      );
    }

    // Overlap check (PENDING/APPROVED only)
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.MANAGER_APPROVED, LeaveStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) {
      return NextResponse.json({ error: "Overlapping leave request exists" }, { status: 409 });
    }

    const created = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: data.type,
        startDate: start,
        endDate: end,
        days,
        reason: data.reason,
        status: LeaveStatus.PENDING,
      },
    });

    // Notify manager (if any), else HR
    const supervisor = employee.supervisorId
      ? await prisma.employee.findUnique({
          where: { id: employee.supervisorId },
          include: { user: true },
        })
      : null;
    if (supervisor?.user) {
      await notify(
        supervisor.user.id,
        NotificationType.LEAVE_REQUEST,
        "New Leave Request",
        `${employee.fullName} requested ${LeaveTypeLabels[data.type]} (${days}d).`,
        `/leave`
      );
    } else {
      await notifyRoles(
        [Role.HR_ADMIN, Role.SUPER_ADMIN],
        NotificationType.LEAVE_REQUEST,
        "New Leave Request",
        `${employee.fullName} requested ${LeaveTypeLabels[data.type]} (${days}d) — no manager assigned.`,
        `/leave`
      );
    }

    await audit({
      userId: session.user.id,
      action: "CREATE",
      entity: "LeaveRequest",
      entityId: created.id,
      after: created,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
