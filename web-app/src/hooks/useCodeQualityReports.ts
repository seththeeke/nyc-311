import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CodeQualityReport, CodeQualityReportSummary } from "../models/codeQualityReport";
import { codeQualityReportService } from "../services/codeQualityReportService";

export const CODE_QUALITY_REPORTS_QUERY_KEY = ["codeQualityReports"] as const;

/* Reports land twice a week; a page load's worth of caching is plenty. */
const STALE_MS = 5 * 60_000;

/** Sable's reports, newest first. Components call hooks, never services (CLAUDE.md §5.1). */
export function useCodeQualityReports(): UseQueryResult<CodeQualityReportSummary[], Error> {
  return useQuery({ queryKey: CODE_QUALITY_REPORTS_QUERY_KEY, queryFn: () => codeQualityReportService.listReports(), staleTime: STALE_MS });
}

/** One report in full; idle until a report is chosen. */
export function useCodeQualityReport(date: string | undefined, time: string | undefined): UseQueryResult<CodeQualityReport, Error> {
  return useQuery({
    queryKey: [...CODE_QUALITY_REPORTS_QUERY_KEY, date, time],
    queryFn: () => codeQualityReportService.getReport(date as string, time as string),
    enabled: Boolean(date && time),
    staleTime: STALE_MS,
  });
}
