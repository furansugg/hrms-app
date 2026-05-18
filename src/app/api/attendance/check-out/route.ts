import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { audit, getClientIp } from "@/lib/audit";
import { startOfDay, endOfDay } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.employeeId) {
      return NextResponse.json({ error: "No employee profile linked" }, { status: 400 });
    }
    const now = new Date();
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: session.user.employeeId,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    });
    if (!existing || !existing.checkInAt) {
      return NextResponse.json({ error: "You must check in first" }, { status: 400 });
    }
    if (existing.checkOutAt) {
      return NextResponse.json({ error: "Already checked out today" }, { status: 409 });
    }
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOutAt: now },
    });
    await audit({
      userId: session.user.id,
      action: "CHECK_OUT",
      entity: "Attendance",
      entityId: updated.id,
      after: { checkOutAt: updated.checkOutAt },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ record: updated });
  } catch (err) {
    return handleError(err);
  }
}
