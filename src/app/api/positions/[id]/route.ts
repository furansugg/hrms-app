import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { positionSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(...Permissions.manageOrg);
    const data = positionSchema.partial().parse(await req.json());
    const before = await prisma.position.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (data.code && data.code !== before.code) {
      const taken = await prisma.position.findUnique({ where: { code: data.code } });
      if (taken) return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    }
    const updated = await prisma.position.update({ where: { id: params.id }, data });
    await audit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Position",
      entityId: updated.id,
      before,
      after: updated,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(...Permissions.manageOrg);
    const pos = await prisma.position.findUnique({ where: { id: params.id } });
    if (!pos) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const activeEmployees = await prisma.employee.count({
      where: { positionId: params.id, status: "ACTIVE" },
    });
    if (activeEmployees > 0) {
      const updated = await prisma.position.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      await audit({
        userId: session.user.id,
        action: "DEACTIVATE",
        entity: "Position",
        entityId: updated.id,
        before: pos,
        after: updated,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: `Cannot delete position with ${activeEmployees} active employees. Position has been deactivated instead.`,
          deactivated: true,
        },
        { status: 409 }
      );
    }
    await prisma.position.delete({ where: { id: params.id } });
    await audit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Position",
      entityId: params.id,
      before: pos,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
