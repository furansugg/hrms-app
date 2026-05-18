/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function ensureSettings() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      companyName: "Furansugg HR Co.",
      companyAddress: "Jl. Sudirman No. 1, Jakarta",
      companyEmail: "hr@furansugg.local",
      companyPhone: "+62 21 1234 5678",
      workStartTime: "08:00",
      workEndTime: "17:00",
      lateThresholdTime: "08:15",
      annualLeaveDefault: 12,
      currency: "IDR",
      lateDeductionPerDay: 50000,
    },
    update: {},
  });
}

async function main() {
  console.log("→ Seeding HRMS database…");
  await ensureSettings();

  const [engDept, hrDept, finDept] = await Promise.all([
    prisma.department.upsert({
      where: { code: "ENG" },
      create: { code: "ENG", name: "Engineering" },
      update: {},
    }),
    prisma.department.upsert({
      where: { code: "HR" },
      create: { code: "HR", name: "Human Resources" },
      update: {},
    }),
    prisma.department.upsert({
      where: { code: "FIN" },
      create: { code: "FIN", name: "Finance" },
      update: {},
    }),
  ]);

  const [posCEO, posHRMgr, posEngMgr, posSWE, posHRGen, posFinAcc] = await Promise.all([
    prisma.position.upsert({
      where: { code: "CEO" },
      create: { code: "CEO", name: "Chief Executive Officer" },
      update: {},
    }),
    prisma.position.upsert({
      where: { code: "HRMGR" },
      create: { code: "HRMGR", name: "HR Manager", departmentId: hrDept.id },
      update: { departmentId: hrDept.id },
    }),
    prisma.position.upsert({
      where: { code: "ENGMGR" },
      create: { code: "ENGMGR", name: "Engineering Manager", departmentId: engDept.id },
      update: { departmentId: engDept.id },
    }),
    prisma.position.upsert({
      where: { code: "SWE" },
      create: { code: "SWE", name: "Software Engineer", departmentId: engDept.id },
      update: { departmentId: engDept.id },
    }),
    prisma.position.upsert({
      where: { code: "HRGEN" },
      create: { code: "HRGEN", name: "HR Generalist", departmentId: hrDept.id },
      update: { departmentId: hrDept.id },
    }),
    prisma.position.upsert({
      where: { code: "ACC" },
      create: { code: "ACC", name: "Accountant", departmentId: finDept.id },
      update: { departmentId: finDept.id },
    }),
  ]);

  // Super Admin
  const superAdminUser = await prisma.user.upsert({
    where: { email: "superadmin@hrms.local" },
    create: {
      email: "superadmin@hrms.local",
      passwordHash: await hash("Admin@123"),
      role: "SUPER_ADMIN",
    },
    update: { passwordHash: await hash("Admin@123"), role: "SUPER_ADMIN" },
  });
  const superAdminEmp = await prisma.employee.upsert({
    where: { nik: "EMP-0001" },
    create: {
      nik: "EMP-0001",
      fullName: "Sarah Director",
      email: "superadmin@hrms.local",
      departmentId: engDept.id,
      positionId: posCEO.id,
      basicSalary: 50000000,
      annualLeaveBalance: 12,
      userId: superAdminUser.id,
    },
    update: { userId: superAdminUser.id },
  });

  // HR Admin
  const hrUser = await prisma.user.upsert({
    where: { email: "hr@hrms.local" },
    create: {
      email: "hr@hrms.local",
      passwordHash: await hash("Hr@1234"),
      role: "HR_ADMIN",
    },
    update: { passwordHash: await hash("Hr@1234"), role: "HR_ADMIN" },
  });
  const hrEmp = await prisma.employee.upsert({
    where: { nik: "EMP-0002" },
    create: {
      nik: "EMP-0002",
      fullName: "Helen Resources",
      email: "hr@hrms.local",
      departmentId: hrDept.id,
      positionId: posHRMgr.id,
      basicSalary: 15000000,
      annualLeaveBalance: 12,
      userId: hrUser.id,
      supervisorId: superAdminEmp.id,
    },
    update: { userId: hrUser.id, supervisorId: superAdminEmp.id },
  });

  // Manager (Engineering Manager)
  const mgrUser = await prisma.user.upsert({
    where: { email: "manager@hrms.local" },
    create: {
      email: "manager@hrms.local",
      passwordHash: await hash("Manager@1"),
      role: "MANAGER",
    },
    update: { passwordHash: await hash("Manager@1"), role: "MANAGER" },
  });
  const mgrEmp = await prisma.employee.upsert({
    where: { nik: "EMP-0003" },
    create: {
      nik: "EMP-0003",
      fullName: "Mark Manager",
      email: "manager@hrms.local",
      departmentId: engDept.id,
      positionId: posEngMgr.id,
      basicSalary: 18000000,
      annualLeaveBalance: 12,
      userId: mgrUser.id,
      supervisorId: superAdminEmp.id,
    },
    update: { userId: mgrUser.id, supervisorId: superAdminEmp.id },
  });

  // Employees
  async function ensureEmployee(p: {
    nik: string;
    email: string;
    password: string;
    role: string;
    fullName: string;
    positionId: string;
    departmentId: string;
    supervisorId?: string;
    basicSalary: number;
  }) {
    const passwordHash = await hash(p.password);
    const user = await prisma.user.upsert({
      where: { email: p.email },
      create: { email: p.email, passwordHash, role: p.role },
      update: { passwordHash, role: p.role },
    });
    return prisma.employee.upsert({
      where: { nik: p.nik },
      create: {
        nik: p.nik,
        fullName: p.fullName,
        email: p.email,
        departmentId: p.departmentId,
        positionId: p.positionId,
        basicSalary: p.basicSalary,
        annualLeaveBalance: 12,
        userId: user.id,
        supervisorId: p.supervisorId,
      },
      update: { userId: user.id, supervisorId: p.supervisorId },
    });
  }

  const emp1 = await ensureEmployee({
    nik: "EMP-0004",
    email: "employee@hrms.local",
    password: "Employee@1",
    role: "EMPLOYEE",
    fullName: "Eve Engineer",
    positionId: posSWE.id,
    departmentId: engDept.id,
    supervisorId: mgrEmp.id,
    basicSalary: 9000000,
  });

  const emp2 = await ensureEmployee({
    nik: "EMP-0005",
    email: "alex@hrms.local",
    password: "Employee@1",
    role: "EMPLOYEE",
    fullName: "Alex Coder",
    positionId: posSWE.id,
    departmentId: engDept.id,
    supervisorId: mgrEmp.id,
    basicSalary: 9500000,
  });

  await ensureEmployee({
    nik: "EMP-0006",
    email: "rina@hrms.local",
    password: "Employee@1",
    role: "EMPLOYEE",
    fullName: "Rina HRGen",
    positionId: posHRGen.id,
    departmentId: hrDept.id,
    supervisorId: hrEmp.id,
    basicSalary: 8500000,
  });

  await ensureEmployee({
    nik: "EMP-0007",
    email: "budi@hrms.local",
    password: "Employee@1",
    role: "EMPLOYEE",
    fullName: "Budi Accountant",
    positionId: posFinAcc.id,
    departmentId: finDept.id,
    supervisorId: superAdminEmp.id,
    basicSalary: 8800000,
  });

  // Sample attendance: yesterday on-time, today late for emp1
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const ydayIn = new Date(yesterday);
  ydayIn.setHours(8, 5, 0, 0);
  const ydayOut = new Date(yesterday);
  ydayOut.setHours(17, 10, 0, 0);
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: emp1.id, date: yesterday } },
    create: {
      employeeId: emp1.id,
      date: yesterday,
      checkInAt: ydayIn,
      checkOutAt: ydayOut,
      status: "PRESENT",
    },
    update: {},
  });

  // Sample late attendance for emp2 yesterday
  const ydayLateIn = new Date(yesterday);
  ydayLateIn.setHours(8, 45, 0, 0);
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: emp2.id, date: yesterday } },
    create: {
      employeeId: emp2.id,
      date: yesterday,
      checkInAt: ydayLateIn,
      status: "LATE",
    },
    update: {},
  });

  console.log("✓ Done.");
  console.log("Demo accounts:");
  console.log("  superadmin@hrms.local / Admin@123");
  console.log("  hr@hrms.local / Hr@1234");
  console.log("  manager@hrms.local / Manager@1");
  console.log("  employee@hrms.local / Employee@1  (Eve Engineer, reports to manager)");
}

main()
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
