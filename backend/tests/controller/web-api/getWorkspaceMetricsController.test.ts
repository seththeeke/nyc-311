import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceMetrics } from "../../../service/analytics/workspaceMetricsService";
import { getWorkspaceMetricsController } from "../../../controller/web-api/getWorkspaceMetricsController";
import type { WorkspaceMetrics } from "../../../models/workspaceMetrics";

vi.mock("../../../service/analytics/workspaceMetricsService", () => ({ getWorkspaceMetrics: vi.fn() }));
const mocked = vi.mocked(getWorkspaceMetrics);

const METRICS: WorkspaceMetrics = {
  source_job: "wbr",
  job_run_id: "01WBR",
  computed_at: "2026-09-26T06:00:00.000Z",
  week_start: "2026-09-21",
  previous_week_start: "2026-09-14",
  metrics: {
    REQUESTS_ACCEPTED: { current: 411, previous: 8635 },
    SERVICED: { current: 411, previous: 832 },
    MEAN_TIME_TO_RESOLVE_HOURS: { current: 1.02, previous: 115.42 },
    MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 0.95, previous: 5.28 },
    TOTAL_COST: { current: null, previous: null },
  },
};

const EVENT = { rawPath: "/workspace/metrics", requestContext: { http: { method: "GET" } } };

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWorkspaceMetricsController", () => {
  it("returns 200 with the workspace metrics", async () => {
    mocked.mockResolvedValue(METRICS);
    const res = await getWorkspaceMetricsController(EVENT);
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(res.body as string)).toEqual(METRICS);
  });

  it("returns 400 for a malformed event, without calling the service", async () => {
    const res = await getWorkspaceMetricsController({ not: "an-event" });
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("S3 down"));
    const res = await getWorkspaceMetricsController(EVENT);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body as string)).toEqual({ message: "Failed to fetch workspace metrics" });
  });

  it("logs a non-Error rejection without crashing", async () => {
    mocked.mockRejectedValue("boom");
    const res = await getWorkspaceMetricsController(EVENT);
    expect(res.statusCode).toBe(500);
  });
});
