import { z } from "zod";

/*
 * The public API's health over the last day, from API Gateway's built-in
 * per-API metrics (16-resident-action-models.md §4, §6.2). Latency is null
 * for a period with no requests.
 */

export const PublicApiMetricsPointSchema = z.object({
  timestamp: z.string().min(1),
  requests: z.number().nonnegative(),
  client_errors: z.number().nonnegative(),
  server_errors: z.number().nonnegative(),
  latency_p50_ms: z.number().nonnegative().nullable(),
  latency_p99_ms: z.number().nonnegative().nullable(),
});
export type PublicApiMetricsPoint = z.infer<typeof PublicApiMetricsPointSchema>;

export const PublicApiMetricsSchema = z.object({
  window_hours: z.number().int().positive(),
  period_seconds: z.number().int().positive(),
  totals: PublicApiMetricsPointSchema.omit({ timestamp: true }),
  points: z.array(PublicApiMetricsPointSchema),
});
export type PublicApiMetrics = z.infer<typeof PublicApiMetricsSchema>;
