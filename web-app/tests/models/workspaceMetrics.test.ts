import { describe, expect, it } from "vitest";
import { WorkspaceMetricsSchema } from "../../src/models/workspaceMetrics";
import { MOCK_WORKSPACE_METRICS } from "../../src/test-data/workspaceMetrics";

describe("WorkspaceMetricsSchema", () => {
  it("accepts the mock fixture", () => {
    expect(WorkspaceMetricsSchema.parse(MOCK_WORKSPACE_METRICS)).toEqual(MOCK_WORKSPACE_METRICS);
  });

  it("accepts the all-null shape of a job that hasn't run", () => {
    const empty = { current: null, previous: null };
    const parsed = WorkspaceMetricsSchema.safeParse({
      source_job: "wbr",
      job_run_id: null,
      computed_at: null,
      week_start: null,
      previous_week_start: null,
      metrics: { REQUESTS_ACCEPTED: empty, SERVICED: empty, MEAN_TIME_TO_RESOLVE_HOURS: empty, MEDIAN_TIME_TO_RESOLVE_HOURS: empty, TOTAL_COST: empty },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a response missing a metric", () => {
    const metrics: Record<string, unknown> = { ...MOCK_WORKSPACE_METRICS.metrics };
    delete metrics.SERVICED;
    expect(WorkspaceMetricsSchema.safeParse({ ...MOCK_WORKSPACE_METRICS, metrics }).success).toBe(false);
  });
});
