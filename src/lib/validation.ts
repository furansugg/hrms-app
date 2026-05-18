import { z } from "zod";
import { Role, EmployeeStatus, LeaveType, PermissionType } from "@/lib/constants";

export const departmentSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  isActive: z.boolean().optional(),
});

export const positionSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  departmentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const employeeSchema = z.object({
  nik: z.string().min(1).max(32),
  fullName: z.string().min(1).max(128),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  supervisorId: z.string().optional().nullable(),
  basicSalary: z.number().nonnegative().default(0),
  joinDate: z.string().or(z.date()).optional(),
  status: z.enum([EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE, EmployeeStatus.TERMINATED]).optional(),
  role: z.enum([Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE]).optional(),
  password: z.string().min(6).optional(),
});

export const employeeUpdateSchema = employeeSchema.partial();

export const leaveSchema = z.object({
  type: z.enum([LeaveType.ANNUAL, LeaveType.SICK, LeaveType.EMERGENCY, LeaveType.UNPAID]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(1).max(500),
});

export const leaveDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export const permissionSchema = z.object({
  type: z.enum([
    PermissionType.LATE_ARRIVAL,
    PermissionType.EARLY_LEAVE,
    PermissionType.OUT_OF_OFFICE,
    PermissionType.OTHER,
  ]),
  date: z.string(),
  reason: z.string().min(1).max(500),
});

export const permissionDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export const payrollGenerateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  employeeIds: z.array(z.string()).optional(),
  defaultAllowances: z.number().nonnegative().default(0).optional(),
});

export const settingsSchema = z.object({
  companyName: z.string().min(1).max(128),
  companyAddress: z.string().nullable().optional(),
  companyEmail: z.string().email().nullable().optional().or(z.literal("")),
  companyPhone: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  lateThresholdTime: z.string().regex(/^\d{2}:\d{2}$/),
  annualLeaveDefault: z.number().int().min(0).max(60),
  currency: z.string().min(1).max(8),
  lateDeductionPerDay: z.number().nonnegative(),
});
