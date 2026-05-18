"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleLabels, Role } from "@/lib/constants";

type Profile = {
  id: string;
  email: string;
  role: string;
  employee: {
    fullName: string;
    nik: string;
    phone: string | null;
    address: string | null;
    department: string | null;
    position: string | null;
    supervisor: string | null;
    joinDate: string;
    annualLeaveBalance: number;
    basicSalary: number;
    status: string;
  } | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/profile", { cache: "no-store" });
    const data = await res.json();
    setProfile(data);
    setPhone(data.employee?.phone ?? "");
    setAddress(data.employee?.address ?? "");
  }
  useEffect(() => {
    load();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = { phone, address };
      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(d.error ?? "Failed");
      toast.success("Profile updated");
      setCurrentPassword("");
      setNewPassword("");
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="p-8 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader title="My Profile" description="View your info and change password" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
            <CardDescription>Your login and role details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Email" value={profile.email} />
            <Row label="Role" value={RoleLabels[profile.role as Role] ?? profile.role} />
            {profile.employee && (
              <>
                <Row label="NIK" value={profile.employee.nik} />
                <Row label="Full Name" value={profile.employee.fullName} />
                <Row label="Department" value={profile.employee.department ?? "-"} />
                <Row label="Position" value={profile.employee.position ?? "-"} />
                <Row label="Supervisor" value={profile.employee.supervisor ?? "-"} />
                <Row label="Join Date" value={formatDate(profile.employee.joinDate)} />
                <Row label="Annual Leave Balance" value={String(profile.employee.annualLeaveBalance)} />
                <Row label="Basic Salary" value={formatCurrency(profile.employee.basicSalary)} />
                <Row label="Status">
                  <Badge variant={profile.employee.status === "ACTIVE" ? "success" : "secondary"}>
                    {profile.employee.status}
                  </Badge>
                </Row>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update contact info and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              {profile.employee && (
                <>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                </>
              )}
              <hr className="my-4" />
              <p className="text-sm text-slate-500">Leave password fields blank to keep current password.</p>
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{children ?? value}</span>
    </div>
  );
}
