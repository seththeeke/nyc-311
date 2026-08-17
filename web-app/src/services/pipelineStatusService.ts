import { config } from "../config";
import { PipelineStatusResponseSchema, type PipelineStatusResponse } from "../models/pipelineStatus";
import { MOCK_PIPELINE_STATUS } from "../test-data/pipelineStatus";

// One interface, two implementations, selected by config.dataMode
// (CLAUDE.md §5.1) — same shape as pollerMetricsService.ts.
export interface PipelineStatusService {
  getPipelineStatus(): Promise<PipelineStatusResponse>;
}

class LivePipelineStatusService implements PipelineStatusService {
  async getPipelineStatus(): Promise<PipelineStatusResponse> {
    // config.pipelineApiBaseUrl is a plain Vite build-time value (never
    // runtime-injected) — 2-pipeline-monitoring.md §9 explains why this
    // field doesn't need the env-config.json mechanism apiBaseUrl does.
    const response = await fetch(`${config.pipelineApiBaseUrl}/pipeline/status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pipeline status: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return PipelineStatusResponseSchema.parse(body);
  }
}

class MockPipelineStatusService implements PipelineStatusService {
  async getPipelineStatus(): Promise<PipelineStatusResponse> {
    return MOCK_PIPELINE_STATUS;
  }
}

export const pipelineStatusService: PipelineStatusService =
  config.dataMode === "live" ? new LivePipelineStatusService() : new MockPipelineStatusService();
