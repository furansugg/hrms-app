"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useT } from "@/lib/i18n/provider";
import { getCurrentPeriod } from "@/lib/utils";

type Option = { id: string; name: string };

export default function ReportsPage() {
  const { t } = useT();
  const [type, setType] = useState<"attendance" | "leave" | "payroll">("attendance");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [depts, setDepts] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepts((d.items ?? []).map((x: Option) => ({ id: x.id, name: x.name }))));
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees((d.items ?? []).map((x: { id: string; fullName: string }) => ({ id: x.id, name: x.fullName }))));
  }, []);

  function buildUrl(format: "xlsx" | "pdf") {
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("format", format);
    if (type === "payroll") {
      if (period) params.set("period", period);
    } else {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (departmentId) params.set("departmentId", departmentId);
    if (employeeId) params.set("employeeId", employeeId);
    return "/api/reports?" + params.toString();
  }

  return (
    <div>
      <PageHeader title={t("reports.title")} description={t("reports.subtitle")} />
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>{t("reports.type")}</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as "attendance" | "leave" | "payroll")}>
              <option value="attendance">{t("reports.typeAttendance")}</option>
              <option value="leave">{t("reports.typeLeave")}</option>
              <option value="payroll">{t("reports.typePayroll")}</option>
            </Select>
          </div>
          {type === "payroll" ? (
            <div className="space-y-2">
              <Label>{t("payroll.period")}</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("common.from")}</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("common.to")}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>{t("common.department")}</Label>
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">{t("common.allDepartments")}</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("common.allEmployees")}</Label>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">{t("common.allEmployees")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-3 flex flex-wrap gap-2 justify-end pt-2">
            <a href={buildUrl("xlsx")} target="_blank" rel="noreferrer">
              <Button>
                <Download className="h-4 w-4" /> {t("reports.formatXLSX")}
              </Button>
            </a>
            <a href={buildUrl("pdf")} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <Download className="h-4 w-4" /> {t("reports.formatPDF")}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
