import { config } from "../config";
import { PollerMetricsResponseSchema, type PollerMetrics } from "../models/pollerMetrics";
import { MOCK_POLLER_METRICS } from "../test-data/pollerMetrics";

// One interface, two implementations, selected by config.dataMode
// (CLAUDE.md §5.1) — the same shape is directly importable in tests, no
// separate test-only mocking story needed.
export interface PollerMetricsService {
  listPollerMetrics(): Promise<PollerMetrics[]>;
}

class LivePollerMetricsService implements PollerMetricsService {
  async listPollerMetrics(): Promise<PollerMetrics[]> {
    // Reads config.apiBaseUrl at call time, not at construction/import
    // time — config.ts's loadRuntimeConfig may still overwrite it between
    // module load and the first real call (see config.ts's doc comment).
    const response = await fetch(`${config.apiBaseUrl}/ingestion/metrics`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ingestion metrics: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return PollerMetricsResponseSchema.parse(body).metrics;
  }
}

class MockPollerMetricsService implements PollerMetricsService {
  async listPollerMetrics(): Promise<PollerMetrics[]> {
    return MOCK_POLLER_METRICS;
  }
}

export const pollerMetricsService: PollerMetricsService =
  config.dataMode === "live" ? new LivePollerMetricsService() : new MockPollerMetricsService();
