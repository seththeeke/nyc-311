import { z } from "zod";

/*
 * The Lambda health tile's own return shape — computed from AWS/Lambda
 * CloudWatch metrics (Invocations, Errors; successes = invocations -
 * errors, CloudWatch has no native "successes" metric), not read from an
 * external boundary in this exact shape, so — like models/pollResult.ts —
 * this has no paired zod schema.
 */

/**
 * `MONITORED_LAMBDAS`, the physical function names cdk/ derives from the
 * stack (`Nyc311MonitoringApiLambda.ts`, #217) — the one boundary input
 * here, so it alone gets a schema.
 */
export const monitoredLambdasSchema = z.array(z.string().min(1)).min(1);
export type MonitoredLambdas = z.infer<typeof monitoredLambdasSchema>;

export interface LambdaHealthPoint {
  /** UTC calendar date (YYYY-MM-DD) this bucket covers — one bucket per day, per the monitoring tile's 7-day window. */
  date: string;
  invocations: number;
  errors: number;
  successes: number;
  /** Daily average / maximum `Duration` in whole ms; `null` on a day CloudWatch has no duration datapoint. */
  avgDurationMs: number | null;
  maxDurationMs: number | null;
}

export interface LambdaHealth {
  /** Stable, human-readable name (e.g. "Poller") — not the physical, env-suffixed functionName. */
  logicalName: string;
  functionName: string;
  points: LambdaHealthPoint[];
}

export interface LambdaMetricsResult {
  lambdas: LambdaHealth[];
}
