import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { employeeUpdateSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { hashPassword } from "@/lib/password";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(...Permissions.manageEmployees);
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        position: true,
        supervisor: { select: { id: true, fullName: true } },
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });
    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(employee);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(...Permissions.manageEmployees);
    const data = employeeUpdateSchema.parse(await req.json());
    const before = await prisma.employee.findUnique({
      where: { id: params.id },
      include: { user: true },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (data.nik && data.nik !== before.nik) {
      const taken = await prisma.employee.findUnique({ where: { nik: data.nik } });
      if (taken) return NextResponse.json({ error: "NIK already exists" }, { status: 409 });
    }
    if (data.email && data.email !== before.email) {
      const taken = await prisma.employee.findFirst({ where: { email: data.email, NOT: { id: before.id } } });
      if (taken) return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      const userTaken = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: before.userId ?? "__none__" } },
      });
      if (userTaken) return NextResponse.json({ error: "Email already used by another account" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: params.id },
        data: {
          nik: data.nik,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone ?? undefined,
          address: data.address ?? undefined,
          departmentId: data.departmentId,
          positionId: data.positionId,
          supervisorId: data.supervisorId ?? undefined,
          basicSalary: data.basicSalary,
          status: data.status,
          joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
        },
      });
      if (before.userId) {
        const userPatch: Record<string, unknown> = {};
        if (data.email && data.email !== before.email) userPatch.email = data.email;
        if (data.role) userPatch.role = data.role;
        if (data.password) userPatch.passwordHash = await hashPassword(data.password);
        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({ where: { id: before.userId }, data: userPatch });
        }
      }
      return emp;
    });

    await audit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Employee",
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
    const session = await requireRole(...Permissions.manageEmployees);
    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Soft delete: set status TERMINATED and deactivate the user account.
    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: params.id },
        data: { status: "TERMINATED" },
      });
      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: false },
        });
      }
      return emp;
    });

    await audit({
      userId: session.user.id,
      action: "TERMINATE",
      entity: "Employee",
      entityId: params.id,
      before: employee,
      after: updated,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
