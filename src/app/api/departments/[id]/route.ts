import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { departmentSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(...Permissions.manageOrg);
    const body = await req.json();
    const data = departmentSchema.partial().parse(body);
    const before = await prisma.department.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (data.code && data.code !== before.code) {
      const taken = await prisma.department.findUnique({ where: { code: data.code } });
      if (taken) return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    }
    const updated = await prisma.department.update({ where: { id: params.id }, data });
    await audit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Department",
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
    const dept = await prisma.department.findUnique({
      where: { id: params.id },
      include: { _count: { select: { employees: true } } },
    });
    if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const activeEmployees = await prisma.employee.count({
      where: { departmentId: params.id, status: "ACTIVE" },
    });
    if (activeEmployees > 0) {
      // Soft-deactivate instead of delete
      const updated = await prisma.department.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      await audit({
        userId: session.user.id,
        action: "DEACTIVATE",
        entity: "Department",
        entityId: updated.id,
        before: dept,
        after: updated,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: `Cannot delete department with ${activeEmployees} active employees. Department has been deactivated instead.`,
          deactivated: true,
        },
        { status: 409 }
      );
    }
    if (dept._count.employees > 0) {
      const updated = await prisma.department.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      await audit({
        userId: session.user.id,
        action: "DEACTIVATE",
        entity: "Department",
        entityId: updated.id,
        before: dept,
        after: updated,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json({ deactivated: true });
    }
    await prisma.department.delete({ where: { id: params.id } });
    await audit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Department",
      entityId: params.id,
      before: dept,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
