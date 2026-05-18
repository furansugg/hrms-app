import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireRole(...Permissions.viewAudit);
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity");
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const take = Math.min(parseInt(searchParams.get("take") ?? "200", 10), 500);

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { email: true, role: true } } },
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}
