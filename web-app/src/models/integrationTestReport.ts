import { z } from "zod";

/*
 * Mirrors backend/tests/integration/support/routeTracker.ts's
 * route-report.json shape — a lightweight, non-gating visibility report
 * (5-pipeline-integration-tests.md §4), not a coverage percentage.
 */

export const RouteReportEntrySchema = z.object({
  hit: z.boolean(),
  statusCode: z.number().int().nullable(),
  ok: z.boolean(),
});
export type RouteReportEntry = z.infer<typeof RouteReportEntrySchema>;

export const IntegrationTestReportSchema = z.object({
  target: z.string().min(1),
  ranAt: z.string().min(1),
  routes: z.record(z.string(), RouteReportEntrySchema),
});
export type IntegrationTestReport = z.infer<typeof IntegrationTestReportSchema>;
