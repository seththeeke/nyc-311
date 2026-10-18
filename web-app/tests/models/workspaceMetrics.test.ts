import { describe, expect, it } from "vitest";
import { WorkspaceMetricsSchema } from "../../src/models/workspaceMetrics";
import { MOCK_WORKSPACE_METRICS } from "../../src/test-data/workspaceMetrics";

describe("WorkspaceMetricsSchema", () => {
  it("accepts the mock fixture", () => {
    expect(WorkspaceMetricsSchema.parse(MOCK_WORKSPACE_METRICS)).toEqual(MOCK_WORKSPACE_METRICS);
  });

  it("accepts null metric values, e.g. no resolutions yet or no week before", () => {
    const empty = { current: null, previous: null };
    const parsed = WorkspaceMetricsSchema.safeParse({
      ...MOCK_WORKSPACE_METRICS,
      metrics: { REQUESTS_ACCEPTED: { current: 0, previous: null }, SERVICED: empty, MEAN_TIME_TO_RESOLVE_HOURS: empty, MEDIAN_TIME_TO_RESOLVE_HOURS: empty, TOTAL_COST: empty },
    });
    expect(parsed.success).toBe(true);
  });

  it("ignores fields the old wbr-backed response carried", () => {
    const legacy = { ...MOCK_WORKSPACE_METRICS, source: "LIVE", source_job: "live", job_run_id: null };
    expect(WorkspaceMetricsSchema.parse(legacy)).toEqual(MOCK_WORKSPACE_METRICS);
  });

  it("rejects a missing or malformed week start", () => {
    expect(WorkspaceMetricsSchema.safeParse({ ...MOCK_WORKSPACE_METRICS, week_start: null }).success).toBe(false);
    expect(WorkspaceMetricsSchema.safeParse({ ...MOCK_WORKSPACE_METRICS, previous_week_start: "Sep 14" }).success).toBe(false);
  });

  it("rejects a response missing a metric", () => {
    const metrics: Record<string, unknown> = { ...MOCK_WORKSPACE_METRICS.metrics };
    delete metrics.SERVICED;
    expect(WorkspaceMetricsSchema.safeParse({ ...MOCK_WORKSPACE_METRICS, metrics }).success).toBe(false);
  });
});
