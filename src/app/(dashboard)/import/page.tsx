"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Role } from "@/lib/constants";
import { Upload, FileText, Download } from "lucide-react";
import { toast } from "sonner";

type ImportResult = { row: number; nik: string; status: string; error?: string };
type Summary = { total: number; created: number; skipped: number; errors: number };

export default function ImportPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;
  if (role !== Role.SUPER_ADMIN && role !== Role.HR_ADMIN) redirect("/dashboard");

  const [empResults, setEmpResults] = useState<ImportResult[]>([]);
  const [empSummary, setEmpSummary] = useState<Summary | null>(null);
  const [attResults, setAttResults] = useState<ImportResult[]>([]);
  const [attSummary, setAttSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const empRef = useRef<HTMLInputElement>(null);
  const attRef = useRef<HTMLInputElement>(null);

  async function uploadFile(endpoint: string, file: File, setResults: (r: ImportResult[]) => void, setSummary: (s: Summary) => void) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      setResults(data.results);
      setSummary(data.summary);
      toast.success(`Import complete: ${data.summary.created} created, ${data.summary.skipped} skipped, ${data.summary.errors} errors`);
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Import</h1>
        <p className="text-sm text-slate-500">Import employees and attendance data from CSV files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Employees</CardTitle>
            <CardDescription>
              CSV columns: nik, fullName, email, departmentCode, positionCode, phone, address, basicSalary, joinDate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("employees")}>
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
            <input ref={empRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile("/api/import/employees", f, setEmpResults, setEmpSummary);
              e.target.value = "";
            }} />
            <Button onClick={() => empRef.current?.click()} disabled={loading}>
              <FileText className="h-4 w-4 mr-1" /> {loading ? "Uploading..." : "Upload CSV"}
            </Button>
            {empSummary && <SummaryBox summary={empSummary} />}
            {empResults.length > 0 && <ResultsTable results={empResults} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Attendance</CardTitle>
            <CardDescription>
              CSV columns: nik, date (YYYY-MM-DD), checkIn (HH:MM), checkOut (HH:MM), status (PRESENT/LATE/ABSENT), note
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("attendance")}>
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
            <input ref={attRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile("/api/import/attendance", f, setAttResults, setAttSummary);
              e.target.value = "";
            }} />
            <Button onClick={() => attRef.current?.click()} disabled={loading}>
              <FileText className="h-4 w-4 mr-1" /> {loading ? "Uploading..." : "Upload CSV"}
            </Button>
            {attSummary && <SummaryBox summary={attSummary} />}
            {attResults.length > 0 && <ResultsTable results={attResults} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryBox({ summary }: { summary: Summary }) {
  return (
    <div className="flex gap-4 text-sm">
      <span>Total: <strong>{summary.total}</strong></span>
      <span className="text-green-600">Created: <strong>{summary.created}</strong></span>
      <span className="text-yellow-600">Skipped: <strong>{summary.skipped}</strong></span>
      <span className="text-red-600">Errors: <strong>{summary.errors}</strong></span>
    </div>
  );
}

function ResultsTable({ results }: { results: ImportResult[] }) {
  return (
    <div className="max-h-60 overflow-auto border rounded">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="px-2 py-1 text-left">Row</th>
            <th className="px-2 py-1 text-left">NIK</th>
            <th className="px-2 py-1 text-left">Status</th>
            <th className="px-2 py-1 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className={r.status === "error" ? "bg-red-50" : r.status === "skipped" ? "bg-yellow-50" : ""}>
              <td className="px-2 py-1">{r.row}</td>
              <td className="px-2 py-1">{r.nik}</td>
              <td className="px-2 py-1 font-medium">{r.status}</td>
              <td className="px-2 py-1 text-slate-500">{r.error || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadTemplate(type: "employees" | "attendance") {
  const templates: Record<string, string> = {
    employees: "nik,fullName,email,departmentCode,positionCode,phone,address,basicSalary,joinDate\nEMP001,John Doe,john@example.com,IT,DEV,08123456789,Jakarta,5000000,2024-01-15",
    attendance: "nik,date,checkIn,checkOut,status,note\nEMP001,2024-01-15,08:00,17:00,PRESENT,",
  };
  const blob = new Blob([templates[type]], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
