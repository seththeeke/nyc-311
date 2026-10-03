import { config } from "../config";
import { WorkspaceMetricsSchema, type WorkspaceMetrics } from "../models/workspaceMetrics";
import { MOCK_WORKSPACE_METRICS } from "../test-data/workspaceMetrics";

/* One interface, two implementations, selected by VITE_DATA_MODE at build time (CLAUDE.md §5.1). */
export interface WorkspaceMetricsService {
  getWorkspaceMetrics(): Promise<WorkspaceMetrics>;
}

class LiveWorkspaceMetricsService implements WorkspaceMetricsService {
  async getWorkspaceMetrics(): Promise<WorkspaceMetrics> {
    const response = await fetch(`${config.apiBaseUrl}/workspace/metrics`);
    if (!response.ok) {
      throw new Error(`Failed to fetch workspace metrics: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return WorkspaceMetricsSchema.parse(body);
  }
}

class MockWorkspaceMetricsService implements WorkspaceMetricsService {
  async getWorkspaceMetrics(): Promise<WorkspaceMetrics> {
    return MOCK_WORKSPACE_METRICS;
  }
}

export const workspaceMetricsService: WorkspaceMetricsService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveWorkspaceMetricsService() : new MockWorkspaceMetricsService();
