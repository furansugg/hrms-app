"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleLabels } from "@/lib/constants";
import Link from "next/link";

export function Topbar() {
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications?unread=true", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread((data.items ?? []).length);
      } catch {
        // ignore
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex-1" />
      <Link
        href="/notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </Link>
      <div className="hidden text-right md:block">
        <div className="text-sm font-medium text-slate-900">
          {session?.user?.name ?? session?.user?.email}
        </div>
        <div className="text-xs text-slate-500">
          {session?.user?.role ? RoleLabels[session.user.role] : ""}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </header>
  );
}
