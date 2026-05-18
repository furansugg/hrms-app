import { prisma } from "@/lib/prisma";

export async function getSettings() {
  let s = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!s) {
    s = await prisma.settings.create({ data: { id: "singleton" } });
  }
  return s;
}
