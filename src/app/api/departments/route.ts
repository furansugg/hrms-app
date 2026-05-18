import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole, requireSession } from "@/lib/rbac";
import { departmentSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;
    const where = {};
    const [items, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: { _count: { select: { employees: true, positions: true } } },
      }),
      prisma.department.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(...Permissions.manageOrg);
    const body = await req.json();
    const data = departmentSchema.parse(body);
    const exists = await prisma.department.findUnique({ where: { code: data.code } });
    if (exists) return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    const created = await prisma.department.create({ data });
    await audit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Department",
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
