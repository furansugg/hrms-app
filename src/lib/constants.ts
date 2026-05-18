export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const EmployeeStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  TERMINATED: "TERMINATED",
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const AttendanceStatus = {
  PRESENT: "PRESENT",
  LATE: "LATE",
  ABSENT: "ABSENT",
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const LeaveType = {
  ANNUAL: "ANNUAL",
  SICK: "SICK",
  EMERGENCY: "EMERGENCY",
  UNPAID: "UNPAID",
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const LeaveStatus = {
  PENDING: "PENDING",
  MANAGER_APPROVED: "MANAGER_APPROVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const PermissionType = {
  LATE_ARRIVAL: "LATE_ARRIVAL",
  EARLY_LEAVE: "EARLY_LEAVE",
  OUT_OF_OFFICE: "OUT_OF_OFFICE",
  OTHER: "OTHER",
} as const;
export type PermissionType = (typeof PermissionType)[keyof typeof PermissionType];

export const PermissionStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PermissionStatus = (typeof PermissionStatus)[keyof typeof PermissionStatus];

export const NotificationType = {
  LEAVE_REQUEST: "LEAVE_REQUEST",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  PERMISSION_REQUEST: "PERMISSION_REQUEST",
  PERMISSION_APPROVED: "PERMISSION_APPROVED",
  PERMISSION_REJECTED: "PERMISSION_REJECTED",
  PAYROLL_GENERATED: "PAYROLL_GENERATED",
  GENERAL: "GENERAL",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const RoleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const LeaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  EMERGENCY: "Emergency Leave",
  UNPAID: "Unpaid Leave",
};

export const PermissionTypeLabels: Record<PermissionType, string> = {
  LATE_ARRIVAL: "Late Arrival",
  EARLY_LEAVE: "Early Leave",
  OUT_OF_OFFICE: "Out of Office",
  OTHER: "Other",
};
