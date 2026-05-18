import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const n = await prisma.notification.findUnique({ where: { id: params.id } });
    if (!n || n.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}
