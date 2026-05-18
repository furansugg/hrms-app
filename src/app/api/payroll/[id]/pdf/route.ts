import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, requireSession } from "@/lib/rbac";
import { buildPayslipPdf } from "@/lib/pdf";
import { Role } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const payroll = await prisma.payroll.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });
    if (!payroll) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Access: employee may view own; managers may view direct reports; HR/Admin: all.
    const userRole = session.user.role;
    if (userRole !== Role.SUPER_ADMIN && userRole !== Role.HR_ADMIN) {
      if (userRole === Role.EMPLOYEE && payroll.employee.id !== session.user.employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (userRole === Role.MANAGER) {
        const isSelf = payroll.employee.id === session.user.employeeId;
        const isSub = session.user.employeeId
          ? (await prisma.employee.count({
              where: { id: payroll.employee.id, supervisorId: session.user.employeeId },
            })) > 0
          : false;
        if (!isSelf && !isSub) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const settings = await getSettings();
    const pdf = buildPayslipPdf({
      companyName: settings.companyName,
      companyAddress: settings.companyAddress ?? null,
      period: payroll.period,
      employee: {
        fullName: payroll.employee.fullName,
        nik: payroll.employee.nik,
        department: payroll.employee.department.name,
        position: payroll.employee.position.name,
      },
      basicSalary: payroll.basicSalary,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
      lateDays: payroll.lateDays,
      unpaidLeaveDays: payroll.unpaidLeaveDays,
      netSalary: payroll.netSalary,
      currency: settings.currency,
      generatedAt: payroll.generatedAt,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="payslip-${payroll.employee.nik}-${payroll.period}.pdf"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
