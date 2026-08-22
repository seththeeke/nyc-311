import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLambdaHealth } from "../../../service/monitoring/lambdaMetricsService";
import { getLambdaMetricsController } from "../../../controller/web-api/getLambdaMetricsController";
import { ValidationError } from "../../../models/errors";
import type { LambdaHealth } from "../../../models/lambdaMetrics";

vi.mock("../../../service/monitoring/lambdaMetricsService", () => ({
  getLambdaHealth: vi.fn(),
}));

const mockedGetLambdaHealth = vi.mocked(getLambdaHealth);

const validEvent = {
  rawPath: "/lambda-metrics",
  requestContext: { http: { method: "GET" } },
};

const lambdas: LambdaHealth[] = [
  {
    logicalName: "Poller",
    functionName: "Nyc311Poller-Test",
    points: [{ date: "2026-08-21", invocations: 4, errors: 0, successes: 4 }],
  },
];

beforeEach(() => {
  mockedGetLambdaHealth.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getLambdaMetricsController", () => {
  it("validates the event, calls getLambdaHealth, and returns 200 with the lambdas", async () => {
    mockedGetLambdaHealth.mockResolvedValue(lambdas);

    const result = await getLambdaMetricsController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual({ lambdas });
  });

  it("returns 400 without calling getLambdaHealth for a malformed event", async () => {
    const result = await getLambdaMetricsController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedGetLambdaHealth).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedGetLambdaHealth.mockRejectedValue(new ValidationError("bad response"));

    const result = await getLambdaMetricsController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedGetLambdaHealth.mockRejectedValue(new Error("CloudWatch throttled"));

    const result = await getLambdaMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedGetLambdaHealth.mockRejectedValue("string rejection");

    const result = await getLambdaMetricsController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
