import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { leaveDecisionSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { LeaveStatus, LeaveType, Role, NotificationType } from "@/lib/constants";
import { notify, notifyRoles } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const data = leaveDecisionSchema.parse(await req.json());
    const stage = new URL(req.url).searchParams.get("stage") ?? "auto"; // manager | hr | auto

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          include: {
            supervisor: { select: { id: true, userId: true } },
            user: true,
          },
        },
      },
    });
    if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isManager =
      session.user.role === Role.MANAGER &&
      session.user.employeeId === leave.employee.supervisorId;
    const isHR = session.user.role === Role.HR_ADMIN || session.user.role === Role.SUPER_ADMIN;

    // Determine which stage applies
    let actingAs: "manager" | "hr";
    if (stage === "manager") {
      if (!isManager && !isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      actingAs = "manager";
    } else if (stage === "hr") {
      if (!isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      actingAs = "hr";
    } else {
      // auto-determine based on current status
      if (leave.status === LeaveStatus.PENDING) {
        if (!isManager && !isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        actingAs = isManager ? "manager" : "hr";
      } else if (leave.status === LeaveStatus.MANAGER_APPROVED) {
        if (!isHR) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        actingAs = "hr";
      } else {
        return NextResponse.json({ error: "Leave request is not pending" }, { status: 400 });
      }
    }

    if (data.decision === "REJECT") {
      const updated = await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: LeaveStatus.REJECTED,
          ...(actingAs === "manager"
            ? {
                managerNote: data.note ?? null,
                decidedManagerBy: session.user.id,
                decidedManagerAt: new Date(),
              }
            : {
                hrNote: data.note ?? null,
                decidedHrBy: session.user.id,
                decidedHrAt: new Date(),
              }),
        },
      });
      if (leave.employee.user) {
        await notify(
          leave.employee.user.id,
          NotificationType.LEAVE_REJECTED,
          "Leave Request Rejected",
          `${actingAs === "manager" ? "Manager" : "HR"} rejected your ${leave.type} leave.${
            data.note ? " Note: " + data.note : ""
          }`,
          "/leave"
        );
      }
      await audit({
        userId: session.user.id,
        action: "REJECT_LEAVE",
        entity: "LeaveRequest",
        entityId: leave.id,
        before: leave,
        after: updated,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(updated);
    }

    // APPROVE
    if (actingAs === "manager") {
      const updated = await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: LeaveStatus.MANAGER_APPROVED,
          managerNote: data.note ?? null,
          decidedManagerBy: session.user.id,
          decidedManagerAt: new Date(),
        },
      });
      await notifyRoles(
        [Role.HR_ADMIN, Role.SUPER_ADMIN],
        NotificationType.LEAVE_REQUEST,
        "Leave Awaiting HR Approval",
        `${leave.employee.fullName} leave request approved by manager — awaiting HR.`,
        "/leave"
      );
      if (leave.employee.user) {
        await notify(
          leave.employee.user.id,
          NotificationType.LEAVE_REQUEST,
          "Manager approved",
          "Your leave was approved by your manager and is now awaiting HR approval.",
          "/leave"
        );
      }
      await audit({
        userId: session.user.id,
        action: "APPROVE_LEAVE_MANAGER",
        entity: "LeaveRequest",
        entityId: leave.id,
        before: leave,
        after: updated,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(updated);
    }

    // HR final approval
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: LeaveStatus.APPROVED,
          hrNote: data.note ?? null,
          decidedHrBy: session.user.id,
          decidedHrAt: new Date(),
          ...(leave.status === LeaveStatus.PENDING
            ? {
                managerNote: leave.managerNote ?? "[Auto-approved by HR]",
                decidedManagerBy: leave.decidedManagerBy ?? session.user.id,
                decidedManagerAt: leave.decidedManagerAt ?? new Date(),
              }
            : {}),
        },
      });
      if (leave.type === LeaveType.ANNUAL) {
        await tx.employee.update({
          where: { id: leave.employeeId },
          data: { annualLeaveBalance: { decrement: leave.days } },
        });
      }
      return u;
    });
    if (leave.employee.user) {
      await notify(
        leave.employee.user.id,
        NotificationType.LEAVE_APPROVED,
        "Leave Approved",
        "Your leave request has been fully approved.",
        "/leave"
      );
    }
    await audit({
      userId: session.user.id,
      action: "APPROVE_LEAVE_HR",
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
