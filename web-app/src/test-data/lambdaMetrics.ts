import type { LambdaHealth } from "../models/lambdaMetrics";

const WEEK = ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"];

function healthyPoints(dailyInvocations: number, avgDurationMs = 120): LambdaHealth["points"] {
  return WEEK.map((date, i) => ({
    date,
    invocations: dailyInvocations,
    errors: 0,
    successes: dailyInvocations,
    avgDurationMs: avgDurationMs + (i % 3) * 15,
    maxDurationMs: avgDurationMs * 4,
  }));
}

/*
 * Baked sample data for "mock" data mode (config.ts) — a small, lightweight
 * fixture set. Mostly healthy, but RequestsFanOut mirrors the shape of the
 * real 2026-08-22 incident this tile was built to catch: errors ==
 * invocations, every single day, since the day it shipped.
 */
export const MOCK_LAMBDA_METRICS: LambdaHealth[] = [
  { logicalName: "Poller", functionName: "Nyc311Poller-Test", points: healthyPoints(4) },
  {
    logicalName: "RequestsFanOut",
    functionName: "Nyc311RequestsFanOut-Test",
    points: ["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"].map((date, i) => ({
      date,
      invocations: 1008 - i * 40,
      errors: 1008 - i * 40,
      successes: 0,
      avgDurationMs: 35,
      maxDurationMs: 90,
    })),
  },
  { logicalName: "RequestEvaluation", functionName: "Nyc311RequestEvaluation-Test", points: [] },
  { logicalName: "MetricsApi", functionName: "Nyc311MetricsApi-Test", points: healthyPoints(12) },
  {
    logicalName: "WorkspaceMetricsApi",
    functionName: "Nyc311WorkspaceMetricsApi-Test",
    /* A gradual latency climb — the drift the latency row exists to show. */
    points: WEEK.map((date, i) => ({
      date,
      invocations: 300,
      errors: 0,
      successes: 300,
      avgDurationMs: 40 + i * 12,
      maxDurationMs: 400 + i * 60,
    })),
  },
  { logicalName: "PipelineStatus", functionName: "Nyc311PipelineStatus", points: healthyPoints(20) },
];
