import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { payrollGenerateSchema } from "@/lib/validation";
import { audit, getClientIp } from "@/lib/audit";
import { computePayroll } from "@/lib/payroll";
import { getSettings } from "@/lib/settings";
import { NotificationType } from "@/lib/constants";
import { notify } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const session = await requireRole(...Permissions.managePayroll);
    const data = payrollGenerateSchema.parse(await req.json());
    const settings = await getSettings();
    const defaultAllowances = data.defaultAllowances ?? 0;

    const employees = data.employeeIds?.length
      ? await prisma.employee.findMany({
          where: { id: { in: data.employeeIds }, status: "ACTIVE" },
          include: { user: true },
        })
      : await prisma.employee.findMany({ where: { status: "ACTIVE" }, include: { user: true } });

    const results: { employeeId: string; status: "GENERATED" | "DUPLICATE" | "ERROR"; payrollId?: string; reason?: string }[] = [];

    for (const employee of employees) {
      const existing = await prisma.payroll.findUnique({
        where: { employeeId_period: { employeeId: employee.id, period: data.period } },
      });
      if (existing) {
        results.push({ employeeId: employee.id, status: "DUPLICATE", payrollId: existing.id });
        continue;
      }
      try {
        const comp = await computePayroll(employee.id, data.period, settings.lateDeductionPerDay, defaultAllowances);
        const created = await prisma.payroll.create({
          data: {
            employeeId: employee.id,
            period: data.period,
            basicSalary: comp.basicSalary,
            allowances: comp.allowances,
            deductions: comp.deductions,
            lateDays: comp.lateDays,
            unpaidLeaveDays: comp.unpaidLeaveDays,
            netSalary: comp.netSalary,
            generatedBy: session.user.id,
          },
        });
        results.push({ employeeId: employee.id, status: "GENERATED", payrollId: created.id });
        if (employee.user) {
          await notify(
            employee.user.id,
            NotificationType.PAYROLL_GENERATED,
            `Payslip available — ${data.period}`,
            `Your payslip for ${data.period} has been generated.`,
            "/payroll"
          );
        }
      } catch (e) {
        results.push({
          employeeId: employee.id,
          status: "ERROR",
          reason: (e as Error).message,
        });
      }
    }

    await audit({
      userId: session.user.id,
      action: "GENERATE_PAYROLL",
      entity: "Payroll",
      entityId: null,
      after: { period: data.period, count: results.length },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      period: data.period,
      generated: results.filter((r) => r.status === "GENERATED").length,
      duplicate: results.filter((r) => r.status === "DUPLICATE").length,
      errors: results.filter((r) => r.status === "ERROR").length,
      results,
    });
  } catch (err) {
    return handleError(err);
  }
}
