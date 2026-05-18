import { NextResponse } from "next/server";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole(...Permissions.manageSettings);
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(...Permissions.manageSettings);
    const data = settingsSchema.parse(await req.json());
    const before = await getSettings();
    const updated = await prisma.settings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data, companyEmail: data.companyEmail || null },
      update: { ...data, companyEmail: data.companyEmail || null },
    });
    await audit({
      userId: session.user.id,
      action: "UPDATE_SETTINGS",
      entity: "Settings",
      entityId: "singleton",
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
