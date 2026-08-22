import type { LambdaHealth } from "../models/lambdaMetrics";

function healthyPoints(dailyInvocations: number): LambdaHealth["points"] {
  return ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"].map(
    (date) => ({ date, invocations: dailyInvocations, errors: 0, successes: dailyInvocations })
  );
}

/*
 * Baked sample data for "mock" data mode (config.ts) — a small, lightweight
 * fixture set. Mostly healthy, but OrderFanOut mirrors the shape of the
 * real 2026-08-22 incident this tile was built to catch: errors ==
 * invocations, every single day, since the day it shipped.
 */
export const MOCK_LAMBDA_METRICS: LambdaHealth[] = [
  { logicalName: "Poller", functionName: "Nyc311Poller-Test", points: healthyPoints(4) },
  {
    logicalName: "OrderFanOut",
    functionName: "Nyc311OrderFanOut-Test",
    points: ["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"].map((date, i) => ({
      date,
      invocations: 1008 - i * 40,
      errors: 1008 - i * 40,
      successes: 0,
    })),
  },
  { logicalName: "RequestEvaluation", functionName: "Nyc311RequestEvaluation-Test", points: [] },
  { logicalName: "MetricsApi", functionName: "Nyc311MetricsApi-Test", points: healthyPoints(12) },
  { logicalName: "OrdersApi", functionName: "Nyc311OrdersApi-Test", points: healthyPoints(9) },
  { logicalName: "PipelineStatus", functionName: "Nyc311PipelineStatus", points: healthyPoints(20) },
];
