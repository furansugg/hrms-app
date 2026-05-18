import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireSession, hasRole } from "@/lib/rbac";
import { Role } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const employeeId = searchParams.get("employeeId");

    const where: Record<string, unknown> = {};
    if (period) where.period = period;

    if (!hasRole(session.user.role, Permissions.managePayroll)) {
      if (session.user.role === Role.MANAGER && session.user.employeeId) {
        const subs = await prisma.employee.findMany({
          where: { supervisorId: session.user.employeeId },
          select: { id: true },
        });
        const ids = subs.map((s) => s.id);
        if (session.user.employeeId) ids.push(session.user.employeeId);
        where.employeeId = { in: ids };
      } else if (session.user.employeeId) {
        where.employeeId = session.user.employeeId;
      } else {
        where.employeeId = "__none__";
      }
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        orderBy: [{ period: "desc" }, { generatedAt: "desc" }],
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              nik: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
      }),
      prisma.payroll.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}
