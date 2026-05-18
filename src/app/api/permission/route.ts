import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { permissionSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { NotificationType, PermissionStatus, PermissionTypeLabels, Role } from "@/lib/constants";
import { notify, notifyRoles } from "@/lib/notifications";
import { getAccessibleEmployeeIds } from "@/lib/employee";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const scope = searchParams.get("scope");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const access = await getAccessibleEmployeeIds({
      id: session.user.id,
      role: session.user.role,
      employeeId: session.user.employeeId,
    });
    if (scope === "mine" && session.user.employeeId) {
      where.employeeId = session.user.employeeId;
    } else if (scope === "team" && session.user.role === Role.MANAGER && session.user.employeeId) {
      const subs = await prisma.employee.findMany({
        where: { supervisorId: session.user.employeeId },
        select: { id: true },
      });
      where.employeeId = { in: subs.map((s) => s.id) };
    } else if (!access.all) {
      where.employeeId = { in: access.ids };
    }
    const items = await prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            supervisorId: true,
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
    const data = permissionSchema.parse(await req.json());
    const date = new Date(data.date);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const created = await prisma.permissionRequest.create({
      data: {
        employeeId: session.user.employeeId,
        type: data.type,
        date,
        reason: data.reason,
        status: PermissionStatus.PENDING,
      },
    });
    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      include: { supervisor: { include: { user: true } } },
    });
    if (employee?.supervisor?.user) {
      await notify(
        employee.supervisor.user.id,
        NotificationType.PERMISSION_REQUEST,
        "New Permission Request",
        `${employee.fullName} requested ${PermissionTypeLabels[data.type]}.`,
        "/permissions"
      );
    } else {
      await notifyRoles(
        [Role.HR_ADMIN, Role.SUPER_ADMIN],
        NotificationType.PERMISSION_REQUEST,
        "New Permission Request",
        `${employee?.fullName ?? "Employee"} requested ${PermissionTypeLabels[data.type]} — no manager assigned.`,
        "/permissions"
      );
    }
    await audit({
      userId: session.user.id,
      action: "CREATE",
      entity: "PermissionRequest",
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
