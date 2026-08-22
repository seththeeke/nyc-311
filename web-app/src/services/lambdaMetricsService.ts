import { config } from "../config";
import { LambdaMetricsResponseSchema, type LambdaHealth } from "../models/lambdaMetrics";
import { MOCK_LAMBDA_METRICS } from "../test-data/lambdaMetrics";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — the same shape is directly importable in tests, no
 * separate test-only mocking story needed.
 */
export interface LambdaMetricsService {
  listLambdaHealth(): Promise<LambdaHealth[]>;
}

class LiveLambdaMetricsService implements LambdaMetricsService {
  async listLambdaHealth(): Promise<LambdaHealth[]> {
    /* Reads config.apiBaseUrl at call time, not import time — see pollerMetricsService.ts's identical note. */
    const response = await fetch(`${config.apiBaseUrl}/lambda-metrics`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Lambda metrics: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return LambdaMetricsResponseSchema.parse(body).lambdas;
  }
}

class MockLambdaMetricsService implements LambdaMetricsService {
  async listLambdaHealth(): Promise<LambdaHealth[]> {
    return MOCK_LAMBDA_METRICS;
  }
}

export const lambdaMetricsService: LambdaMetricsService =
  config.dataMode === "live" ? new LiveLambdaMetricsService() : new MockLambdaMetricsService();
