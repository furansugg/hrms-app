import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { audit, getClientIp } from "@/lib/audit";
import { LeaveStatus, LeaveType, Role, NotificationType } from "@/lib/constants";
import { notifyRoles } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: { employee: { include: { user: true } } },
    });
    if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = session.user.employeeId === leave.employeeId;
    const isHR = session.user.role === Role.HR_ADMIN || session.user.role === Role.SUPER_ADMIN;
    if (!isOwner && !isHR) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (leave.status === LeaveStatus.REJECTED || leave.status === LeaveStatus.CANCELLED) {
      return NextResponse.json({ error: "Cannot cancel a request that is already " + leave.status.toLowerCase() }, { status: 400 });
    }

    const wasApproved = leave.status === LeaveStatus.APPROVED;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { status: LeaveStatus.CANCELLED },
      });
      if (wasApproved && leave.type === LeaveType.ANNUAL) {
        await tx.employee.update({
          where: { id: leave.employeeId },
          data: { annualLeaveBalance: { increment: leave.days } },
        });
      }
      return u;
    });

    await notifyRoles(
      [Role.HR_ADMIN, Role.SUPER_ADMIN],
      NotificationType.LEAVE_REQUEST,
      "Leave Cancelled",
      `${leave.employee.fullName} cancelled their ${leave.type} leave (${leave.days}d).`,
      "/leave"
    );

    await audit({
      userId: session.user.id,
      action: "CANCEL_LEAVE",
      entity: "LeaveRequest",
      entityId: leave.id,
      before: leave,
      after: updated,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}
