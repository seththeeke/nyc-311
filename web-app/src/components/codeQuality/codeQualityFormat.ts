import type { CodeQualityReportSummary } from "../../models/codeQualityReport";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-09" + "23_30" → "Nov 9, 2026 · 23:30 CT" (a report's folder is its run's start in CT). */
export function formatRun(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year} · ${time.replace("_", ":")} CT`;
}

/** A report's stable id in the page's state. */
export function reportId(report: Pick<CodeQualityReportSummary, "date" | "time">): string {
  return `${report.date}/${report.time}`;
}

/** The change since the package's last audit, as text that doesn't rely on colour: "↑ 6", "↓ 3", "no change", "first audit". */
export function formatChange(score: number | null, previous: number | null): string {
  if (score === null) return "no score";
  if (previous === null) return "first audit";
  const delta = score - previous;
  if (delta === 0) return "no change";
  return delta > 0 ? `↑ ${delta}` : `↓ ${-delta}`;
}

/** Each package's newest report, in the order packages first appear (newest first). */
export function latestByPackage(reports: readonly CodeQualityReportSummary[]): CodeQualityReportSummary[] {
  const seen = new Map<string, CodeQualityReportSummary>();
  for (const report of reports) if (!seen.has(report.package)) seen.set(report.package, report);
  return [...seen.values()];
}
