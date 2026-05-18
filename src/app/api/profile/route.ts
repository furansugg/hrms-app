import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        employee: {
          include: {
            department: { select: { name: true } },
            position: { select: { name: true } },
            supervisor: { select: { fullName: true } },
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      employee: user.employee
        ? {
            fullName: user.employee.fullName,
            nik: user.employee.nik,
            phone: user.employee.phone,
            address: user.employee.address,
            department: user.employee.department?.name,
            position: user.employee.position?.name,
            supervisor: user.employee.supervisor?.fullName,
            joinDate: user.employee.joinDate,
            annualLeaveBalance: user.employee.annualLeaveBalance,
            basicSalary: user.employee.basicSalary,
            status: user.employee.status,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

const updateSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    const body = updateSchema.parse(await req.json());

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const valid = await bcrypt.compare(body.currentPassword, user.password);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: await bcrypt.hash(body.newPassword, 12) },
      });
    }

    if (session.user.employeeId && (body.phone !== undefined || body.address !== undefined)) {
      const data: Record<string, string> = {};
      if (body.phone !== undefined) data.phone = body.phone;
      if (body.address !== undefined) data.address = body.address;
      await prisma.employee.update({
        where: { id: session.user.employeeId },
        data,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
