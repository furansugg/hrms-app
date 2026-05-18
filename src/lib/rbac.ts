import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return session;
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) {
    throw new HttpError(403, "Forbidden");
  }
  return session;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof Error) {
    console.error("[API error]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export const Permissions = {
  // Who can manage employees, departments, positions
  manageEmployees: [Role.SUPER_ADMIN, Role.HR_ADMIN],
  manageOrg: [Role.SUPER_ADMIN, Role.HR_ADMIN],
  // Who approves leave at HR level
  approveLeaveHr: [Role.SUPER_ADMIN, Role.HR_ADMIN],
  // Who approves leave at manager level
  approveLeaveManager: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER],
  // Payroll
  managePayroll: [Role.SUPER_ADMIN, Role.HR_ADMIN],
  // Reports
  viewReports: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER],
  // Audit
  viewAudit: [Role.SUPER_ADMIN],
  // Settings
  manageSettings: [Role.SUPER_ADMIN, Role.HR_ADMIN],
} as const;

export function hasRole(role: Role | undefined, allowed: readonly Role[]): boolean {
  return !!role && allowed.includes(role);
}
