import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLambdaHealth } from "../../../service/monitoring/lambdaMetricsService";

const cwMock = mockClient(CloudWatchClient);
const client = new CloudWatchClient({});

const ENV_VARS: Record<string, string> = {
  MONITORED_LAMBDA_POLLER: "Nyc311Poller-Test",
  MONITORED_LAMBDA_ORDER_FAN_OUT: "Nyc311OrderFanOut-Test",
  MONITORED_LAMBDA_REQUEST_EVALUATION: "Nyc311RequestEvaluation-Test",
  MONITORED_LAMBDA_ORDER_EVENT_FAN_OUT: "Nyc311OrderEventFanOut-Test",
  MONITORED_LAMBDA_ORDER_EVALUATION: "Nyc311OrderEvaluation-Test",
  MONITORED_LAMBDA_METRICS_API: "Nyc311MetricsApi-Test",
  MONITORED_LAMBDA_ORDERS_API: "Nyc311OrdersApi-Test",
  MONITORED_LAMBDA_ORDER_EVENTS_API: "Nyc311OrderEventsApi-Test",
  MONITORED_LAMBDA_PIPELINE_STATUS: "Nyc311PipelineStatus",
};

const NOW = new Date("2026-08-22T00:00:00.000Z");
const now = () => NOW;

let previousEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  cwMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  previousEnv = {};
  for (const [key, value] of Object.entries(ENV_VARS)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("getLambdaHealth", () => {
  it("returns one entry per monitored lambda, with daily invocation/error/success points", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName === "Nyc311Poller-Test" && input.MetricName === "Invocations") {
        return { Datapoints: [{ Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 4 }] };
      }
      if (functionName === "Nyc311Poller-Test" && input.MetricName === "Errors") {
        return { Datapoints: [{ Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 0 }] };
      }
      return { Datapoints: [] };
    });

    const result = await getLambdaHealth({ client, now });

    expect(result).toHaveLength(9);
    const poller = result.find((r) => r.logicalName === "Poller");
    expect(poller).toEqual({
      logicalName: "Poller",
      functionName: "Nyc311Poller-Test",
      points: [{ date: "2026-08-21", invocations: 4, errors: 0, successes: 4 }],
    });
  });

  it("merges same-date Invocations/Errors datapoints into one point (the fan-out incident's exact shape: errors == invocations)", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName !== "Nyc311OrderFanOut-Test") return { Datapoints: [] };
      return { Datapoints: [{ Timestamp: new Date("2026-08-19T00:00:00.000Z"), Sum: 1008 }] };
    });

    const result = await getLambdaHealth({ client, now });

    const fanOut = result.find((r) => r.logicalName === "OrderFanOut");
    expect(fanOut?.points).toEqual([{ date: "2026-08-19", invocations: 1008, errors: 1008, successes: 0 }]);
  });

  it("sorts points chronologically by date regardless of the order CloudWatch returns them", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName !== "Nyc311Poller-Test" || input.MetricName !== "Invocations") return { Datapoints: [] };
      return {
        Datapoints: [
          { Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 4 },
          { Timestamp: new Date("2026-08-19T00:00:00.000Z"), Sum: 4 },
          { Timestamp: new Date("2026-08-20T00:00:00.000Z"), Sum: 4 },
        ],
      };
    });

    const result = await getLambdaHealth({ client, now });

    const poller = result.find((r) => r.logicalName === "Poller");
    expect(poller?.points.map((p) => p.date)).toEqual(["2026-08-19", "2026-08-20", "2026-08-21"]);
  });

  it("ignores a datapoint missing a Timestamp or Sum", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName !== "Nyc311Poller-Test" || input.MetricName !== "Invocations") return { Datapoints: [] };
      return {
        Datapoints: [
          { Timestamp: undefined, Sum: 4 },
          { Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: undefined },
        ],
      };
    });

    const result = await getLambdaHealth({ client, now });

    const poller = result.find((r) => r.logicalName === "Poller");
    expect(poller?.points).toEqual([]);
  });

  it("keeps an already-seen date's errors count when a later invocations datapoint repeats that date", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName !== "Nyc311Poller-Test") return { Datapoints: [] };
      if (input.MetricName === "Errors") {
        return { Datapoints: [{ Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 1 }] };
      }
      /* Two Invocations datapoints on the same date — exercises the "date already in byDate" merge branch. */
      return {
        Datapoints: [
          { Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 2 },
          { Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 3 },
        ],
      };
    });

    const result = await getLambdaHealth({ client, now });

    const poller = result.find((r) => r.logicalName === "Poller");
    expect(poller?.points).toEqual([{ date: "2026-08-21", invocations: 3, errors: 1, successes: 2 }]);
  });

  it("defaults invocations to 0 for a date that only has an errors datapoint", async () => {
    cwMock.on(GetMetricStatisticsCommand).callsFake((input) => {
      const functionName = input.Dimensions?.[0]?.Value;
      if (functionName !== "Nyc311Poller-Test") return { Datapoints: [] };
      if (input.MetricName === "Errors") {
        return { Datapoints: [{ Timestamp: new Date("2026-08-21T00:00:00.000Z"), Sum: 2 }] };
      }
      return { Datapoints: [] };
    });

    const result = await getLambdaHealth({ client, now });

    const poller = result.find((r) => r.logicalName === "Poller");
    expect(poller?.points).toEqual([{ date: "2026-08-21", invocations: 0, errors: 2, successes: -2 }]);
  });

  it("treats a response with no Datapoints as an empty series", async () => {
    cwMock.on(GetMetricStatisticsCommand).resolves({});

    const result = await getLambdaHealth({ client, now });

    expect(result.every((r) => r.points.length === 0)).toBe(true);
  });

  it("defaults `client` and `now` to fresh instances when not injected", async () => {
    cwMock.on(GetMetricStatisticsCommand).resolves({ Datapoints: [] });

    await expect(getLambdaHealth()).resolves.toHaveLength(9);
  });

  it("throws when a monitored lambda's env var is unset", async () => {
    delete process.env.MONITORED_LAMBDA_POLLER;

    await expect(getLambdaHealth({ client, now })).rejects.toThrow(
      "Missing required environment variable: MONITORED_LAMBDA_POLLER"
    );
  });
});
