import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permissions, handleError, requireRole } from "@/lib/rbac";
import { parseCSV } from "@/lib/csv";
import { hashPassword, generatePassword } from "@/lib/password";
import { Role } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
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

    const requiredFields = ["nik", "fullName", "email", "departmentCode", "positionCode"];
    const firstRow = rows[0];
    const missing = requiredFields.filter((f) => !(f in firstRow));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const results: { row: number; nik: string; status: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const dept = await prisma.department.findUnique({ where: { code: row.departmentCode } });
        if (!dept) {
          results.push({ row: i + 2, nik: row.nik, status: "error", error: `Department ${row.departmentCode} not found` });
          continue;
        }
        const pos = await prisma.position.findUnique({ where: { code: row.positionCode } });
        if (!pos) {
          results.push({ row: i + 2, nik: row.nik, status: "error", error: `Position ${row.positionCode} not found` });
          continue;
        }

        const existing = await prisma.employee.findFirst({
          where: { OR: [{ nik: row.nik }, { email: row.email }] },
        });
        if (existing) {
          results.push({ row: i + 2, nik: row.nik, status: "skipped", error: "NIK or email already exists" });
          continue;
        }

        const password = generatePassword();
        const passwordHash = await hashPassword(password);

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: row.email, passwordHash, role: Role.EMPLOYEE },
          });
          await tx.employee.create({
            data: {
              nik: row.nik,
              fullName: row.fullName,
              email: row.email,
              phone: row.phone || null,
              address: row.address || null,
              departmentId: dept.id,
              positionId: pos.id,
              basicSalary: row.basicSalary ? parseFloat(row.basicSalary) : 0,
              joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
              annualLeaveBalance: settings.annualLeaveDefault,
              userId: user.id,
            },
          });
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
      entity: "Employee",
      after: { totalRows: rows.length, created },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ results, summary: { total: rows.length, created, skipped: results.filter((r) => r.status === "skipped").length, errors: results.filter((r) => r.status === "error").length } });
  } catch (err) {
    return handleError(err);
  }
}
