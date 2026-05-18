import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/constants";

export type SessionUserShape = {
  id: string;
  role: Role;
  employeeId: string | null;
};

/** Find subordinate employee IDs for a manager session user (direct reports). */
export async function getDirectReportIds(user: SessionUserShape): Promise<string[]> {
  if (!user.employeeId) return [];
  const subs = await prisma.employee.findMany({
    where: { supervisorId: user.employeeId },
    select: { id: true },
  });
  return subs.map((s) => s.id);
}

/** Determine which employee IDs a user can access (self + subordinates for managers, all for HR/Admin). */
export async function getAccessibleEmployeeIds(
  user: SessionUserShape
): Promise<{ all: boolean; ids: string[] }> {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.HR_ADMIN) {
    return { all: true, ids: [] };
  }
  if (user.role === Role.MANAGER) {
    const subs = await getDirectReportIds(user);
    return {
      all: false,
      ids: user.employeeId ? [user.employeeId, ...subs] : subs,
    };
  }
  return { all: false, ids: user.employeeId ? [user.employeeId] : [] };
}
