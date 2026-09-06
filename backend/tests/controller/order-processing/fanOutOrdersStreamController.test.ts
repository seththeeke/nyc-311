import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { fanOutOrdersStreamRecord } from "../../../service/order/orderEvaluationService";
import { fanOutOrdersStreamController } from "../../../controller/order-processing/fanOutOrdersStreamController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/order/orderEvaluationService", () => ({
  fanOutOrdersStreamRecord: vi.fn(),
}));

const mockedFanOutOrdersStreamRecord = vi.mocked(fanOutOrdersStreamRecord);
const fakeContext = { awsRequestId: "req-123" } as Context;

function makeRecord(sequenceNumber: string): unknown {
  return {
    eventName: "INSERT",
    dynamodb: { NewImage: { sk: { S: "EVENT#0" } }, SequenceNumber: sequenceNumber },
  };
}

beforeEach(() => {
  mockedFanOutOrdersStreamRecord.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutOrdersStreamController", () => {
  it("validates the event and calls the service once per record", async () => {
    const event = { Records: [makeRecord("1"), makeRecord("2")] };

    const response = await fanOutOrdersStreamController(event, fakeContext);

    expect(mockedFanOutOrdersStreamRecord).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("returns an empty batchItemFailures list for an empty batch, without calling the service", async () => {
    const response = await fanOutOrdersStreamController({ Records: [] }, fakeContext);

    expect(mockedFanOutOrdersStreamRecord).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("reports only the failed record's SequenceNumber as a batchItemFailure, and still processes the rest", async () => {
    mockedFanOutOrdersStreamRecord
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SNS unavailable"))
      .mockResolvedValueOnce(undefined);
    const event = { Records: [makeRecord("1"), makeRecord("2"), makeRecord("3")] };

    const response = await fanOutOrdersStreamController(event, fakeContext);

    expect(mockedFanOutOrdersStreamRecord).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "2" }] });
  });

  it("reports every failed record when more than one fails in the same batch", async () => {
    mockedFanOutOrdersStreamRecord.mockRejectedValueOnce(new Error("boom 1")).mockRejectedValueOnce(new Error("boom 2"));
    const event = { Records: [makeRecord("1"), makeRecord("2")] };

    const response = await fanOutOrdersStreamController(event, fakeContext);

    expect(response.batchItemFailures).toEqual(
      expect.arrayContaining([{ itemIdentifier: "1" }, { itemIdentifier: "2" }])
    );
    expect(response.batchItemFailures).toHaveLength(2);
  });

  it("reports a batchItemFailure when the service rejects with a non-Error value", async () => {
    mockedFanOutOrdersStreamRecord.mockRejectedValueOnce("string rejection");
    const event = { Records: [makeRecord("1")] };

    const response = await fanOutOrdersStreamController(event, fakeContext);

    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("rejects a malformed event without calling the service", async () => {
    await expect(fanOutOrdersStreamController({ Records: "not-an-array" }, fakeContext)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(mockedFanOutOrdersStreamRecord).not.toHaveBeenCalled();
  });

  it("rejects a non-object payload", async () => {
    await expect(fanOutOrdersStreamController("not-an-object", fakeContext)).rejects.toBeInstanceOf(ValidationError);
  });
});
