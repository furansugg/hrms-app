import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole, requireSession } from "@/lib/rbac";
import { departmentSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const items = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true, positions: true } } },
    });
    return NextResponse.json({ items });
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
