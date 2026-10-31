import type { PublicApiMetrics } from "../models/publicApiMetrics";

/* A quiet day with a few resident calls each hour and one bad request. */
const START = Date.parse("2026-11-02T00:00:00.000Z");

export const MOCK_PUBLIC_API_METRICS: PublicApiMetrics = {
  window_hours: 24,
  period_seconds: 3600,
  totals: { requests: 58, client_errors: 2, server_errors: 0, latency_p50_ms: 42, latency_p99_ms: 310 },
  points: Array.from({ length: 24 }, (_, hour) => {
    const requests = hour % 3 === 0 ? 4 : 2;
    return {
      timestamp: new Date(START + hour * 3_600_000).toISOString(),
      requests,
      client_errors: hour === 9 || hour === 17 ? 1 : 0,
      server_errors: 0,
      latency_p50_ms: 38 + (hour % 5),
      latency_p99_ms: 120 + hour * 8,
    };
  }),
};
