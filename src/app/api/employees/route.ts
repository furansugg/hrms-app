import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole, requireSession } from "@/lib/rbac";
import { employeeSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { generatePassword, hashPassword } from "@/lib/password";
import { Role } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { nik: { contains: q } },
        { email: { contains: q } },
      ];
    }
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    // Non-admins: limit results
    if (session.user.role === Role.MANAGER) {
      const subs = await prisma.employee.findMany({
        where: { supervisorId: session.user.employeeId ?? "" },
        select: { id: true },
      });
      const ids = subs.map((s) => s.id);
      if (session.user.employeeId) ids.push(session.user.employeeId);
      where.id = { in: ids };
    } else if (session.user.role === Role.EMPLOYEE) {
      where.id = session.user.employeeId ?? "__none__";
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { fullName: "asc" },
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, name: true, code: true } },
          supervisor: { select: { id: true, fullName: true } },
          user: { select: { id: true, email: true, role: true, isActive: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(...Permissions.manageEmployees);
    const data = employeeSchema.parse(await req.json());

    // Validate dept/position
    const [dept, pos] = await Promise.all([
      prisma.department.findUnique({ where: { id: data.departmentId } }),
      prisma.position.findUnique({ where: { id: data.positionId } }),
    ]);
    if (!dept || !dept.isActive) {
      return NextResponse.json({ error: "Department not found or inactive" }, { status: 400 });
    }
    if (!pos || !pos.isActive) {
      return NextResponse.json({ error: "Position not found or inactive" }, { status: 400 });
    }

    // Uniqueness
    const conflict = await prisma.employee.findFirst({
      where: { OR: [{ nik: data.nik }, { email: data.email }] },
    });
    if (conflict) {
      return NextResponse.json(
        { error: conflict.nik === data.nik ? "NIK already exists" : "Email already exists" },
        { status: 409 }
      );
    }
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) {
      return NextResponse.json({ error: "Email already used by another account" }, { status: 409 });
    }

    const settings = await getSettings();
    const password = data.password ?? generatePassword();
    const passwordHash = await hashPassword(password);
    const role = data.role ?? Role.EMPLOYEE;

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role,
        },
      });
      return tx.employee.create({
        data: {
          nik: data.nik,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone ?? null,
          address: data.address ?? null,
          departmentId: data.departmentId,
          positionId: data.positionId,
          supervisorId: data.supervisorId ?? null,
          basicSalary: data.basicSalary ?? 0,
          joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
          status: data.status ?? "ACTIVE",
          annualLeaveBalance: settings.annualLeaveDefault,
          userId: user.id,
        },
      });
    });

    await audit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      after: employee,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(
      { employee, generatedPassword: data.password ? undefined : password },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
