import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { parseCSV } from "@/lib/csv";
import { audit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await requireRole(...Permissions.manageEmployees);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
    }

    const requiredFields = ["nik", "date", "checkIn", "checkOut", "status"];
    const firstRow = rows[0];
    const missing = requiredFields.filter((f) => !(f in firstRow));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const results: { row: number; nik: string; status: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const employee = await prisma.employee.findUnique({ where: { nik: row.nik } });
        if (!employee) {
          results.push({ row: i + 2, nik: row.nik, status: "error", error: "Employee not found" });
          continue;
        }

        const date = new Date(row.date);
        if (isNaN(date.getTime())) {
          results.push({ row: i + 2, nik: row.nik, status: "error", error: "Invalid date" });
          continue;
        }
        date.setHours(0, 0, 0, 0);

        const existing = await prisma.attendance.findUnique({
          where: { employeeId_date: { employeeId: employee.id, date } },
        });
        if (existing) {
          results.push({ row: i + 2, nik: row.nik, status: "skipped", error: "Attendance already exists for this date" });
          continue;
        }

        const checkInAt = row.checkIn ? new Date(`${row.date}T${row.checkIn}`) : null;
        const checkOutAt = row.checkOut ? new Date(`${row.date}T${row.checkOut}`) : null;

        await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date,
            checkInAt,
            checkOutAt,
            status: row.status || "PRESENT",
            note: row.note || null,
          },
        });

        results.push({ row: i + 2, nik: row.nik, status: "created" });
      } catch (e) {
        results.push({
          row: i + 2,
          nik: row.nik || "",
          status: "error",
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    await audit({
      userId: session.user.id,
      action: "IMPORT",
      entity: "Attendance",
      after: { totalRows: rows.length, created },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      results,
      summary: {
        total: rows.length,
        created,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
