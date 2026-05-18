"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    const res = await fetch(`/api/notifications?page=${page}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    toast.success("All notifications marked as read");
    load();
  }
  async function markOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System and approval notifications"
        actions={
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {items.length === 0 && (
            <p className="p-6 text-center text-slate-500">No notifications.</p>
          )}
          <ul className="divide-y divide-slate-200">
            {items.map((n) => (
              <li key={n.id} className="p-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    {!n.isRead && <Badge variant="info">New</Badge>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <div className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt, true)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {n.link && (
                    <Link href={n.link} className="text-sm text-emerald-700 hover:underline">
                      Open →
                    </Link>
                  )}
                  {!n.isRead && (
                    <Button size="sm" variant="ghost" onClick={() => markOne(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
