import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { integrationTestReportService } from "../services/integrationTestReportService";
import type { IntegrationTestReport } from "../models/integrationTestReport";

export const INTEGRATION_TEST_REPORT_QUERY_KEY = ["integrationTestReport"] as const;

/* Matches useLambdaMetrics.ts's cadence — no need to poll more aggressively than a pipeline run's own frequency. */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useIntegrationTestReport(): UseQueryResult<IntegrationTestReport, Error> {
  return useQuery({
    queryKey: INTEGRATION_TEST_REPORT_QUERY_KEY,
    queryFn: () => integrationTestReportService.getReport(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
