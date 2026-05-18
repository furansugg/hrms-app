import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/lib/constants";

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link: link ?? null },
    });
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, message, link: link ?? null })),
  });
}

export async function notifyRoles(
  roles: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  await notifyMany(users.map((u) => u.id), type, title, message, link);
}
