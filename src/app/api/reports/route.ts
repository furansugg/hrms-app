import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { audit, getClientIp } from "@/lib/audit";
import { buildReportPdf } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LeaveTypeLabels, type LeaveType } from "@/lib/constants";

type ReportType = "attendance" | "leave" | "payroll";
type Format = "xlsx" | "pdf";

export async function GET(req: Request) {
  try {
    const session = await requireRole(...Permissions.viewReports);
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") ?? "attendance") as ReportType;
    const format = (searchParams.get("format") ?? "xlsx") as Format;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const period = searchParams.get("period");
    const departmentId = searchParams.get("departmentId");
    const employeeId = searchParams.get("employeeId");

    const settings = await getSettings();
    const empWhere: Record<string, unknown> = {};
    if (departmentId) empWhere.departmentId = departmentId;
    if (employeeId) empWhere.id = employeeId;
    const empIds = Object.keys(empWhere).length
      ? (await prisma.employee.findMany({ where: empWhere, select: { id: true } })).map((e) => e.id)
      : null;

    const meta: Record<string, string> = {};
    if (from) meta["From"] = from;
    if (to) meta["To"] = to;
    if (period) meta["Period"] = period;
    if (departmentId) {
      const d = await prisma.department.findUnique({ where: { id: departmentId } });
      meta["Department"] = d?.name ?? "?";
    }
    if (employeeId) {
      const e = await prisma.employee.findUnique({ where: { id: employeeId } });
      meta["Employee"] = e?.fullName ?? "?";
    }

    let columns: string[] = [];
    let rows: (string | number)[][] = [];
    let title = "";

    if (type === "attendance") {
      const where: Record<string, unknown> = {};
      if (from || to) {
        const range: Record<string, Date> = {};
        if (from) range.gte = new Date(from);
        if (to) range.lte = new Date(to + "T23:59:59");
        where.date = range;
      }
      if (empIds) where.employeeId = { in: empIds };
      const recs = await prisma.attendance.findMany({
        where,
        orderBy: { date: "desc" },
        include: { employee: { select: { fullName: true, nik: true } } },
      });
      title = "Attendance Report";
      columns = ["Date", "NIK", "Employee", "Check-in", "Check-out", "Status"];
      rows = recs.map((r) => [
        formatDate(r.date),
        r.employee.nik,
        r.employee.fullName,
        r.checkInAt ? formatDate(r.checkInAt, true).slice(11) : "-",
        r.checkOutAt ? formatDate(r.checkOutAt, true).slice(11) : "-",
        r.status,
      ]);
    } else if (type === "leave") {
      const where: Record<string, unknown> = {};
      if (from || to) {
        const range: Record<string, Date> = {};
        if (from) range.gte = new Date(from);
        if (to) range.lte = new Date(to + "T23:59:59");
        where.startDate = range;
      }
      if (empIds) where.employeeId = { in: empIds };
      const recs = await prisma.leaveRequest.findMany({
        where,
        orderBy: { startDate: "desc" },
        include: { employee: { select: { fullName: true, nik: true } } },
      });
      title = "Leave Report";
      columns = ["Employee", "NIK", "Type", "From", "To", "Days", "Status", "Reason"];
      rows = recs.map((r) => [
        r.employee.fullName,
        r.employee.nik,
        LeaveTypeLabels[r.type as LeaveType] ?? r.type,
        formatDate(r.startDate),
        formatDate(r.endDate),
        r.days,
        r.status,
        r.reason,
      ]);
    } else {
      const where: Record<string, unknown> = {};
      if (period) where.period = period;
      if (empIds) where.employeeId = { in: empIds };
      const recs = await prisma.payroll.findMany({
        where,
        orderBy: [{ period: "desc" }],
        include: { employee: { select: { fullName: true, nik: true } } },
      });
      title = "Payroll Report";
      columns = ["Period", "Employee", "NIK", "Basic", "Allowances", "Deductions", "Late Days", "Unpaid Days", "Net"];
      rows = recs.map((r) => [
        r.period,
        r.employee.fullName,
        r.employee.nik,
        formatCurrency(r.basicSalary, settings.currency),
        formatCurrency(r.allowances, settings.currency),
        formatCurrency(r.deductions, settings.currency),
        r.lateDays,
        r.unpaidLeaveDays,
        formatCurrency(r.netSalary, settings.currency),
      ]);
    }

    await audit({
      userId: session.user.id,
      action: "EXPORT_REPORT",
      entity: "Report",
      entityId: null,
      after: { type, format, ...meta },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    if (format === "pdf") {
      const buf = buildReportPdf(
        { title, subtitle: meta["From"] || meta["Period"] ? `${meta["From"] ?? ""} ${meta["To"] ? "→ " + meta["To"] : ""}${meta["Period"] ?? ""}` : undefined, columns, rows, meta },
        settings.companyName
      );
      return new NextResponse(Buffer.from(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${type}-report.pdf"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings.companyName;
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title);
    let row = 1;
    sheet.getCell(`A${row}`).value = settings.companyName;
    sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    row += 1;
    sheet.getCell(`A${row}`).value = title;
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;
    for (const [k, v] of Object.entries(meta)) {
      sheet.getCell(`A${row}`).value = `${k}: ${v}`;
      row += 1;
    }
    row += 1;
    sheet.getRow(row).values = columns;
    sheet.getRow(row).font = { bold: true };
    row += 1;
    for (const r of rows) {
      sheet.getRow(row).values = r;
      row += 1;
    }
    sheet.columns.forEach((col) => {
      col.width = Math.max(12, (col.header as string)?.length ?? 12);
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const xlsxBuf = Buffer.from(arrayBuffer as ArrayBuffer);
    return new NextResponse(xlsxBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${type}-report.xlsx"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
