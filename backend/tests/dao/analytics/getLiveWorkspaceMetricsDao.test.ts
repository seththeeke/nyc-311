import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveWorkspaceMetricsDao } from "../../../dao/analytics/liveWorkspaceMetricsDao";
import { getLiveWorkspaceMetricsDao } from "../../../dao/analytics/getLiveWorkspaceMetricsDao";

describe("getLiveWorkspaceMetricsDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new LiveWorkspaceMetricsDao on every call", () => {
    vi.stubEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME", "LiveWorkspaceMetrics-Test");
    const dao = getLiveWorkspaceMetricsDao();
    expect(dao).toBeInstanceOf(LiveWorkspaceMetricsDao);
    expect(getLiveWorkspaceMetricsDao()).not.toBe(dao);
  });

  it("throws when LIVE_WORKSPACE_METRICS_TABLE_NAME is missing", () => {
    vi.stubEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME", "");
    expect(() => getLiveWorkspaceMetricsDao()).toThrow("LIVE_WORKSPACE_METRICS_TABLE_NAME");
  });
});
