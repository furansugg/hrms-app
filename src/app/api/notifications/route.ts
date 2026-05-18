import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const unread = searchParams.get("unread") === "true";
    const items = await prisma.notification.findMany({
      where: { userId: session.user.id, ...(unread ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { all } = await req.json().catch(() => ({ all: false }));
    if (all) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
