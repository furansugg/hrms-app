"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Clock,
  CalendarDays,
  FileClock,
  Wallet,
  FileBarChart,
  Bell,
  Settings,
  ScrollText,
} from "lucide-react";
import { Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: readonly Role[];
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE] },
  { href: "/employees", label: "Employees", icon: Users, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER] },
  { href: "/departments", label: "Departments", icon: Building2, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN] },
  { href: "/positions", label: "Positions", icon: Briefcase, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN] },
  { href: "/attendance", label: "Attendance", icon: Clock, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE] },
  { href: "/leave", label: "Leave", icon: CalendarDays, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE] },
  { href: "/permissions", label: "Permissions", icon: FileClock, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE] },
  { href: "/payroll", label: "Payroll", icon: Wallet, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.EMPLOYEE] },
  { href: "/reports", label: "Reports", icon: FileBarChart, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER, Role.EMPLOYEE] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: [Role.SUPER_ADMIN] },
  { href: "/settings", label: "Settings", icon: Settings, roles: [Role.SUPER_ADMIN, Role.HR_ADMIN] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const items = role ? NAV.filter((i) => i.roles.includes(role)) : [];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-slate-100">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <div className="h-8 w-8 rounded-md bg-emerald-500 flex items-center justify-center font-bold text-slate-900">
          H
        </div>
        <div className="font-semibold tracking-tight">HRMS</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        v0.1.0 · HRMS
      </div>
    </aside>
  );
}
