import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { getAccessibleEmployeeIds } from "@/lib/employee";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");

    const where: Record<string, unknown> = {};
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to + "T23:59:59");
      where.date = range;
    }

    const access = await getAccessibleEmployeeIds({
      id: session.user.id,
      role: session.user.role,
      employeeId: session.user.employeeId,
    });
    if (employeeId) {
      if (!access.all && !access.ids.includes(employeeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      where.employeeId = employeeId;
    } else if (!access.all) {
      where.employeeId = { in: access.ids };
    }

    const items = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { employee: { select: { id: true, fullName: true, nik: true } } },
      take: 500,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}
