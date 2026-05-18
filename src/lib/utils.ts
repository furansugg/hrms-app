import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "IDR") {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function formatDate(date: Date | string | null | undefined, withTime = false) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  if (!withTime) return dateStr;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} ${time}`;
}

export function startOfDay(d: Date = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseHHMM(timeStr: string, base: Date = new Date()): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function diffBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

export function getCurrentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
