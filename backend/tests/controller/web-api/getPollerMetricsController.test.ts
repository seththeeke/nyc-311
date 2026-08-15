import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPollerMetrics } from "../../../service/ingestion/nyc311PollerService";
import { getPollerMetricsController } from "../../../controller/web-api/getPollerMetricsController";
import { ValidationError } from "../../../models/errors";
import type { PollerMetrics } from "../../../models/pollerMetrics";

vi.mock("../../../service/ingestion/nyc311PollerService", () => ({
  listPollerMetrics: vi.fn(),
}));

const mockedListPollerMetrics = vi.mocked(listPollerMetrics);

const validEvent = {
  rawPath: "/ingestion/metrics",
  requestContext: { http: { method: "GET" } },
};

beforeEach(() => {
  mockedListPollerMetrics.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPollerMetricsController", () => {
  it("validates the event, calls listPollerMetrics, and returns 200 with the metrics", async () => {
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

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual({ metrics });
  });

  it("returns 400 without calling listPollerMetrics for a malformed event", async () => {
    const result = await getPollerMetricsController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedListPollerMetrics).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedListPollerMetrics.mockRejectedValue(new ValidationError("bad stored item"));

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedListPollerMetrics.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedListPollerMetrics.mockRejectedValue("string rejection");

    const result = await getPollerMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
