import { redirect } from "next/navigation";
import { getSession } from "@/lib/rbac";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
