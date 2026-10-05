import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { recordWorkspaceMetricEvent } from "../../../service/analytics/liveWorkspaceMetricsService";
import { recordWorkspaceMetricsController } from "../../../controller/analytics/recordWorkspaceMetricsController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/liveWorkspaceMetricsService", () => ({
  recordWorkspaceMetricEvent: vi.fn(),
}));

const mockedRecord = vi.mocked(recordWorkspaceMetricEvent);
const fakeContext = { awsRequestId: "req-123" } as Context;

const validOrderEvent = {
  order_id: "01ORDER",
  sequence_number: 0,
  event_type: "ORDER_ACCEPTED",
  stage: null,
  payload: {},
  occurred_at: "2026-08-26T00:00:00.000Z",
  actor: "SYSTEM",
};

function makeRecord(messageId: string, body: unknown = validOrderEvent): unknown {
  return { messageId, body: JSON.stringify(body) };
}

beforeEach(() => {
  mockedRecord.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordWorkspaceMetricsController", () => {
  it("validates the event, parses each body, and calls the service once per record", async () => {
    const event = { Records: [makeRecord("1"), makeRecord("2")] };

    const response = await recordWorkspaceMetricsController(event, fakeContext);

    expect(mockedRecord).toHaveBeenCalledTimes(2);
    expect(mockedRecord).toHaveBeenCalledWith(validOrderEvent);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("returns an empty batchItemFailures list for an empty batch, without calling the service", async () => {
    const response = await recordWorkspaceMetricsController({ Records: [] }, fakeContext);

    expect(mockedRecord).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("reports only the failed record's messageId as a batchItemFailure, and still processes the rest", async () => {
    mockedRecord
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("DynamoDB throttled"))
      .mockResolvedValueOnce(undefined);
    const event = { Records: [makeRecord("1"), makeRecord("2"), makeRecord("3")] };

    const response = await recordWorkspaceMetricsController(event, fakeContext);

    expect(mockedRecord).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "2" }] });
  });

  it("reports a batchItemFailure for a message body that isn't valid JSON, without calling the service", async () => {
    const event = { Records: [{ messageId: "1", body: "not-json" }] };

    const response = await recordWorkspaceMetricsController(event, fakeContext);

    expect(mockedRecord).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("reports a batchItemFailure for a body that fails OrderEvent validation, without calling the service", async () => {
    const event = { Records: [makeRecord("1", { not: "an order event" })] };

    const response = await recordWorkspaceMetricsController(event, fakeContext);

    expect(mockedRecord).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("reports a batchItemFailure when the service rejects with a non-Error value", async () => {
    mockedRecord.mockRejectedValueOnce("string rejection");
    const event = { Records: [makeRecord("1")] };

    const response = await recordWorkspaceMetricsController(event, fakeContext);

    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("rejects a malformed event without calling the service", async () => {
    await expect(recordWorkspaceMetricsController({ Records: "not-an-array" }, fakeContext)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("rejects a non-object payload", async () => {
    await expect(recordWorkspaceMetricsController("not-an-object", fakeContext)).rejects.toBeInstanceOf(ValidationError);
  });
});
