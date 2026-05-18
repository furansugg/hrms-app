import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { audit, getClientIp } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { parseHHMM, startOfDay, endOfDay } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.employeeId) {
      return NextResponse.json({ error: "No employee profile linked to this account" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: session.user.employeeId } });
    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json({ error: "Employee is not active" }, { status: 400 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const existing = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: { gte: todayStart, lte: todayEnd } },
    });
    if (existing?.checkInAt) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 409 });
    }

    const settings = await getSettings();
    const lateAt = parseHHMM(settings.lateThresholdTime, now);
    const isLate = now > lateAt;

    const record = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkInAt: now,
            status: isLate ? "LATE" : "PRESENT",
            ipAddress: getClientIp(req),
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: todayStart,
            checkInAt: now,
            status: isLate ? "LATE" : "PRESENT",
            ipAddress: getClientIp(req),
          },
        });

    await audit({
      userId: session.user.id,
      action: "CHECK_IN",
      entity: "Attendance",
      entityId: record.id,
      after: { checkInAt: record.checkInAt, status: record.status },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ record, isLate });
  } catch (err) {
    return handleError(err);
  }
}
