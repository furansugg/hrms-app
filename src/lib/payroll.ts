import { prisma } from "@/lib/prisma";
import { LeaveStatus, LeaveType } from "@/lib/constants";

export function periodRange(period: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export type PayrollComputation = {
  basicSalary: number;
  allowances: number;
  deductions: number;
  lateDays: number;
  unpaidLeaveDays: number;
  netSalary: number;
};

export async function computePayroll(
  employeeId: string,
  period: string,
  lateDeductionPerDay: number,
  defaultAllowances = 0
): Promise<PayrollComputation> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  const { start, end } = periodRange(period);

  const [lateDays, unpaidLeaves] = await Promise.all([
    prisma.attendance.count({
      where: { employeeId, status: "LATE", date: { gte: start, lte: end } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: LeaveType.UNPAID,
        status: LeaveStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    }),
  ]);

  const unpaidLeaveDays = unpaidLeaves.reduce((sum, l) => sum + l.days, 0);
  const basicSalary = employee.basicSalary;
  const dailyRate = basicSalary / 22; // 22 working days
  const lateDeductions = lateDays * lateDeductionPerDay;
  const unpaidDeductions = unpaidLeaveDays * dailyRate;
  const deductions = Math.round(lateDeductions + unpaidDeductions);
  const allowances = defaultAllowances;
  const netSalary = Math.max(0, Math.round(basicSalary + allowances - deductions));
  return {
    basicSalary,
    allowances,
    deductions,
    lateDays,
    unpaidLeaveDays,
    netSalary,
  };
}
