# HRMS — Human Resource Management System

A full-stack Human Resource Management System built with **Next.js 14 (App Router)**, **Prisma**, **SQLite**, **NextAuth**, and **Tailwind CSS**.

It implements the four phases described in the brief:

1. **Phase 1 — Core**: Auth, RBAC, Employee / Department / Position management.
2. **Phase 2 — Attendance & Leave**: Check-in/out with late detection, leave & permission requests with multi-level approvals.
3. **Phase 3 — Payroll & Reports**: Monthly payroll generation, PDF payslips, Excel + PDF reports.
4. **Phase 4 — Operations**: In-app notifications, audit logs, configurable company settings.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   Edit DATABASE_URL and NEXTAUTH_SECRET if needed

# 3. Initialise DB + seed demo data
npx prisma migrate deploy
npm run db:seed

# 4. Run the dev server
npm run dev
# open http://localhost:3000
```

### Demo accounts

| Role          | Email                     | Password    |
| ------------- | ------------------------- | ----------- |
| Super Admin   | `superadmin@hrms.local`   | `Admin@123` |
| HR Admin      | `hr@hrms.local`           | `Hr@1234`   |
| Manager       | `manager@hrms.local`      | `Manager@1` |
| Employee      | `employee@hrms.local`     | `Employee@1`|

`Mark Manager` is the supervisor of `Eve Engineer` and `Alex Coder`. Use that pairing to test the multi-level leave approval flow (employee → manager → HR).

---

## Tech stack

- **Framework**: Next.js 14 (App Router, server components + route handlers)
- **Database**: SQLite (file-based, easy to swap for Postgres)
- **ORM**: Prisma 5
- **Auth**: NextAuth (Credentials provider, JWT sessions, bcrypt password hashing)
- **UI**: Tailwind CSS + custom shadcn-style components, `lucide-react`, `sonner` toasts
- **Reporting**: `jspdf` + `jspdf-autotable` (PDF), `exceljs` (XLSX)
- **Validation**: `zod`
- **Language**: TypeScript

---

## Project layout

```
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script

src/
  app/
    layout.tsx
    page.tsx
    login/
    (dashboard)/    # All authenticated routes (sidebar + topbar)
      dashboard/
      employees/
      departments/
      positions/
      attendance/
      leave/
      permissions/
      payroll/
      reports/
      notifications/
      audit-logs/
      settings/
    api/            # Route handlers
  components/
    layout/         # Sidebar, Topbar
    ui/             # Buttons, inputs, dialogs, table, etc.
  lib/              # auth, prisma, rbac, audit, notifications, pdf, payroll, etc.
```

---

## Database schema overview

Key models (see `prisma/schema.prisma` for the full definitions):

- `User` — Login account with `role` (`SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`) and bcrypt password hash.
- `Employee` — Profile linked to `User` (1:1), with unique `nik` and `email`, `supervisorId` for the org tree, `annualLeaveBalance`.
- `Department` / `Position` — Organisational structure, both with `isActive` flag. Deletion is blocked when an active employee references them and falls back to deactivation.
- `Attendance` — One row per employee per day (`@@unique([employeeId, date])`), tracks check-in/out times, status (`PRESENT` / `LATE` / `ABSENT`).
- `LeaveRequest` — `type` (`ANNUAL` / `SICK` / `EMERGENCY` / `UNPAID`), `status` (`PENDING` → `MANAGER_APPROVED` → `APPROVED`, or `REJECTED`), with separate `managerNote` / `hrNote` and decision timestamps.
- `PermissionRequest` — Short permissions (late, early leave, …), approved by manager.
- `Payroll` — One row per employee per period (`@@unique([employeeId, period])`), with `basicSalary`, `allowances`, `deductions`, `lateDays`, `unpaidLeaveDays`, `netSalary`.
- `Notification`, `AuditLog`, `Settings` (singleton row with `id = "singleton"`).

Enums are stored as strings (SQLite has no native enums) — see `src/lib/constants.ts` for the canonical values.

---

## Validation rules (enforced server-side)

- **Unique** Employee `nik` and `email`; unique Department / Position `code`.
- **Active-employee guard**: Department / Position deletes are converted to deactivation if any active employee references them.
- **Attendance**: only one check-in per employee per day; check-out requires a prior check-in. `LATE` status is set when the check-in time is after the configured `lateThresholdTime` (default `08:15`).
- **Leave balance**: annual leave requires `annualLeaveBalance >= days`. Balance is decremented only on **final HR approval**.
- **Leave overlap**: new requests overlapping any `PENDING` / `MANAGER_APPROVED` / `APPROVED` requests are rejected.
- **Multi-level approval**: manager must approve first when the employee has a supervisor; HR (or Super Admin) gives the final approval. Employees without a supervisor route directly to HR.
- **Payroll duplicate prevention**: generating payroll twice for the same `(employee, period)` returns `DUPLICATE` instead of creating a second row.
- **Settings**: HH:mm validated; currency / annual leave default sanitised.

---

## RBAC

| Capability                          | SUPER_ADMIN | HR_ADMIN | MANAGER          | EMPLOYEE |
| ----------------------------------- | :---------: | :------: | :--------------: | :------: |
| Manage employees / departments / positions | ✓ | ✓ |   |   |
| View all employees                  |     ✓       |    ✓     | (direct reports) | (self)   |
| Check-in / out, request leave / permission |     ✓       |    ✓     | ✓                | ✓        |
| Approve leave (manager stage)       |     ✓ (any) |    ✓ (any) | ✓ (own team) |   |
| Approve leave (HR final stage)      |     ✓       |    ✓     |                  |          |
| Generate payroll                    |     ✓       |    ✓     |                  |          |
| View payslip                        |     ✓ (any) |    ✓ (any) | (team + self) | (self) |
| Export reports                      |     ✓       |    ✓     | ✓                |          |
| View audit logs                     |     ✓       |          |                  |          |
| Manage settings                     |     ✓       |    ✓     |                  |          |

Server-side enforcement lives in `src/lib/rbac.ts` (`Permissions` map + `requireRole(...)`). Client-side rendering hides actions the user can't perform, but every API also re-checks.

The Next.js `src/middleware.ts` blocks unauthenticated access to all dashboard routes; `getSession()` re-checks server-side in layouts.

---

## API reference

All endpoints are JSON. Mutating endpoints require a valid session cookie. Errors return `{ "error": "message" }` with the appropriate status code.

### Auth

- `POST /api/auth/callback/credentials` — NextAuth credentials login.
- `GET  /api/auth/session` — current session.

### Departments — `manageOrg` roles only

- `GET  /api/departments`
- `POST /api/departments`           — `{ code, name, isActive? }`
- `PUT  /api/departments/:id`
- `DELETE /api/departments/:id`     — soft-deactivates if employees still attached.

### Positions — `manageOrg`

- `GET  /api/positions`
- `POST /api/positions`             — `{ code, name, departmentId?, isActive? }`
- `PUT  /api/positions/:id`
- `DELETE /api/positions/:id`       — same soft-deactivation behaviour.

### Employees — `manageEmployees`

- `GET  /api/employees?q=&departmentId=&status=`
- `GET  /api/employees/:id`
- `POST /api/employees`             — also creates the user account. If `password` is omitted, a random one is generated and returned in the response as `generatedPassword`.
- `PUT  /api/employees/:id`         — can also rotate password and change role.
- `DELETE /api/employees/:id`       — soft-terminates and disables the linked user account.

### Attendance

- `GET  /api/attendance?from=&to=&employeeId=`
- `POST /api/attendance/check-in`   — one per day; sets `LATE` when after `lateThresholdTime`.
- `POST /api/attendance/check-out`  — requires prior check-in.

### Leave

- `GET  /api/leave?scope=mine|team|all&status=`
- `POST /api/leave`                 — `{ type, startDate, endDate, reason }`
- `POST /api/leave/:id/decision?stage=manager|hr` — `{ decision: "APPROVE" | "REJECT", note? }`

### Permission requests

- `GET  /api/permission?scope=mine|team|all`
- `POST /api/permission`            — `{ type, date, reason }`
- `POST /api/permission/:id/decision` — `{ decision, note? }`

### Payroll — `managePayroll`

- `GET  /api/payroll?period=YYYY-MM&employeeId=`
- `POST /api/payroll/generate`      — `{ period, employeeIds?, defaultAllowances? }` — duplicates are reported, not re-generated.
- `GET  /api/payroll/:id/pdf`       — streams the payslip PDF.

### Reports — `viewReports`

- `GET  /api/reports?type=attendance|leave|payroll&format=xlsx|pdf&from=&to=&period=&departmentId=&employeeId=`

### Notifications

- `GET  /api/notifications?unread=true`
- `POST /api/notifications`         — `{ all: true }` marks all read
- `POST /api/notifications/:id/read`

### Audit logs — `SUPER_ADMIN`

- `GET  /api/audit-logs?entity=&action=&userId=&take=`

### Settings — `manageSettings`

- `GET  /api/settings`
- `PUT  /api/settings`              — see `settingsSchema` for fields.

---

## Multi-level leave approval — flow

1. Employee submits a leave request via `POST /api/leave`. Status becomes `PENDING`.
2. If they have a supervisor, the supervisor sees the request in **Leave → Team Approvals**. They call `POST /api/leave/:id/decision?stage=manager` with `APPROVE` → status becomes `MANAGER_APPROVED`, or with `REJECT` → status becomes `REJECTED`.
3. HR sees `PENDING (no supervisor)` and `MANAGER_APPROVED` requests in **Leave → All / HR Approvals**. They call `POST /api/leave/:id/decision?stage=hr`. On `APPROVE`, status becomes `APPROVED` and (for `ANNUAL` leave) the employee's `annualLeaveBalance` is decremented.

Notifications are emitted at every step (manager → notified on submission, employee → notified on each decision, HR → notified after manager approval).

---

## Payroll formula

```
dailyRate          = basicSalary / 22
lateDeduction      = lateDays × lateDeductionPerDay
unpaidDeduction    = unpaidLeaveDays × dailyRate
totalDeductions    = lateDeduction + unpaidDeduction
netSalary          = max(0, basicSalary + allowances − totalDeductions)
```

`lateDays` is sourced from `Attendance.status = LATE` in the period.
`unpaidLeaveDays` is sourced from approved `LeaveRequest`s with `type = UNPAID` overlapping the period.

---

## NPM scripts

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Next.js dev server                                        |
| `npm run build`     | Production build                                          |
| `npm run start`     | Production server (after build)                           |
| `npm run lint`      | ESLint                                                    |
| `npm run typecheck` | `tsc --noEmit`                                            |
| `npm run db:push`   | Push the Prisma schema to the database (no migration)     |
| `npm run db:migrate`| `prisma migrate deploy`                                   |
| `npm run db:seed`   | Seed demo data (`prisma/seed.ts`)                         |
| `npm run db:reset`  | Reset DB (skips seeding — run `db:seed` afterwards)       |

---

## Environment variables

See `.env.example`.

```ini
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me"
```

For production, switch `DATABASE_URL` to your Postgres/MySQL connection string and update `prisma/schema.prisma` accordingly (the schema only depends on standard SQL features).

---

## License

MIT.
