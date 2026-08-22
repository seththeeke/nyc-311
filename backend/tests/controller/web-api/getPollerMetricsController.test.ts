import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCursorStatus, listPollerMetrics } from "../../../service/ingestion/nyc311RequestService";
import { getPollerMetricsController } from "../../../controller/web-api/getPollerMetricsController";
import { ValidationError } from "../../../models/errors";
import type { PollerMetrics } from "../../../models/pollerMetrics";
import type { IngestionCursorStatus } from "../../../models/ingestionCursor";

vi.mock("../../../service/ingestion/nyc311RequestService", () => ({
  listPollerMetrics: vi.fn(),
  getCursorStatus: vi.fn(),
}));

const mockedListPollerMetrics = vi.mocked(listPollerMetrics);
const mockedGetCursorStatus = vi.mocked(getCursorStatus);

const validEvent = {
  rawPath: "/ingestion/metrics",
  requestContext: { http: { method: "GET" } },
};

const cursorStatus: IngestionCursorStatus = {
  last_watermark: "2026-08-19T00:00:00",
  resume_offset: null,
  lag_hours: 72,
  is_stale: false,
};

beforeEach(() => {
  mockedListPollerMetrics.mockReset();
  mockedGetCursorStatus.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPollerMetricsController", () => {
  it("validates the event, calls listPollerMetrics and getCursorStatus, and returns 200 with both", async () => {
    const metrics: PollerMetrics[] = [
      {
        ran_at: "2026-08-15T00:00:00.000Z",
        success: true,
        records_ingested: 5,
        duplicates_skipped: 1,
        records_rejected: 0,
        error_message: null,
      },
    ];
    mockedListPollerMetrics.mockResolvedValue(metrics);
    mockedGetCursorStatus.mockResolvedValue(cursorStatus);

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual({ metrics, cursor: cursorStatus });
  });

  it("returns cursor: null when no cursor item exists yet", async () => {
    mockedListPollerMetrics.mockResolvedValue([]);
    mockedGetCursorStatus.mockResolvedValue(null);

    const result = await getPollerMetricsController(validEvent);

    expect(JSON.parse(result.body as string)).toEqual({ metrics: [], cursor: null });
  });

  it("returns 400 without calling listPollerMetrics or getCursorStatus for a malformed event", async () => {
    const result = await getPollerMetricsController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedListPollerMetrics).not.toHaveBeenCalled();
    expect(mockedGetCursorStatus).not.toHaveBeenCalled();
  });

  it("returns 400 when a service call throws a ValidationError", async () => {
    mockedListPollerMetrics.mockResolvedValue([]);
    mockedGetCursorStatus.mockRejectedValue(new ValidationError("bad stored item"));

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedListPollerMetrics.mockRejectedValue(new Error("DynamoDB throttled"));
    mockedGetCursorStatus.mockResolvedValue(cursorStatus);

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedListPollerMetrics.mockRejectedValue("string rejection");
    mockedGetCursorStatus.mockResolvedValue(cursorStatus);

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
