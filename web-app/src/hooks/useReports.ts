import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { reportsService } from "../services/reportsService";
import type { ReportsResponse } from "../models/report";

export const REPORTS_QUERY_KEY = ["reports"] as const;

/* Reports are recomputed once a day by the warehouse job runner — a 60s poll is plenty, matching useIntegrationTestReport.ts. */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useReports(): UseQueryResult<ReportsResponse, Error> {
  return useQuery({
    queryKey: REPORTS_QUERY_KEY,
    queryFn: () => reportsService.getReports(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
