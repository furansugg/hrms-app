import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { permissionDecisionSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { NotificationType, PermissionStatus, Role } from "@/lib/constants";
import { notify } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const data = permissionDecisionSchema.parse(await req.json());
    const request = await prisma.permissionRequest.findUnique({
      where: { id: params.id },
      include: { employee: { include: { supervisor: true, user: true } } },
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (request.status !== PermissionStatus.PENDING) {
      return NextResponse.json({ error: "Already decided" }, { status: 400 });
    }
    const isManager =
      session.user.role === Role.MANAGER &&
      session.user.employeeId === request.employee.supervisorId;
    const isHR = session.user.role === Role.HR_ADMIN || session.user.role === Role.SUPER_ADMIN;
    if (!isManager && !isHR) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const updated = await prisma.permissionRequest.update({
      where: { id: request.id },
      data: {
        status: data.decision === "APPROVE" ? PermissionStatus.APPROVED : PermissionStatus.REJECTED,
        managerNote: data.note ?? null,
        decidedBy: session.user.id,
        decidedAt: new Date(),
      },
    });
    if (request.employee.user) {
      await notify(
        request.employee.user.id,
        data.decision === "APPROVE"
          ? NotificationType.PERMISSION_APPROVED
          : NotificationType.PERMISSION_REJECTED,
        data.decision === "APPROVE" ? "Permission Approved" : "Permission Rejected",
        data.note ?? `Your permission request was ${data.decision.toLowerCase()}.`,
        "/permissions"
      );
    }
    await audit({
      userId: session.user.id,
      action: data.decision === "APPROVE" ? "APPROVE_PERMISSION" : "REJECT_PERMISSION",
      entity: "PermissionRequest",
      entityId: request.id,
      before: request,
      after: updated,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}
