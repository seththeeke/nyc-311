import { config } from "../config";
import { PublicApiMetricsSchema, type PublicApiMetrics } from "../models/publicApiMetrics";
import { MOCK_PUBLIC_API_METRICS } from "../test-data/publicApiMetrics";

/* One interface, live and in-memory implementations, chosen by VITE_DATA_MODE (CLAUDE.md §5.1). */
export interface PublicApiMetricsService {
  getMetrics(): Promise<PublicApiMetrics>;
}

class LivePublicApiMetricsService implements PublicApiMetricsService {
  async getMetrics(): Promise<PublicApiMetrics> {
    const response = await fetch(`${config.apiBaseUrl}/public-api/metrics`);
    if (!response.ok) {
      throw new Error(`Failed to fetch public API metrics: HTTP ${response.status}`);
    }
    return PublicApiMetricsSchema.parse(await response.json());
  }
}

class MockPublicApiMetricsService implements PublicApiMetricsService {
  async getMetrics(): Promise<PublicApiMetrics> {
    return MOCK_PUBLIC_API_METRICS;
  }
}

export const publicApiMetricsService: PublicApiMetricsService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LivePublicApiMetricsService() : new MockPublicApiMetricsService();
