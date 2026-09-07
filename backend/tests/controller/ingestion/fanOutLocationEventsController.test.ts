import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { fanOutLocationRecord } from "../../../service/ingestion/locationEventService";
import { fanOutLocationEventsController } from "../../../controller/ingestion/fanOutLocationEventsController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/ingestion/locationEventService", () => ({ fanOutLocationRecord: vi.fn() }));

const mocked = vi.mocked(fanOutLocationRecord);
const ctx = { awsRequestId: "req-123" } as Context;

function record(sequenceNumber: string): unknown {
  return {
    eventName: "INSERT",
    dynamodb: { NewImage: { location_id: { S: "1000000000" } }, SequenceNumber: sequenceNumber },
  };
}

beforeEach(() => {
  mocked.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutLocationEventsController", () => {
  it("validates the event and calls the service once per record", async () => {
    const response = await fanOutLocationEventsController({ Records: [record("1"), record("2")] }, ctx);
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("returns an empty batch for an empty Records list, without calling the service", async () => {
    const response = await fanOutLocationEventsController({ Records: [] }, ctx);
    expect(mocked).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("reports only the failed record's SequenceNumber and still processes the rest", async () => {
    mocked
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SNS unavailable"))
      .mockResolvedValueOnce(undefined);

    const response = await fanOutLocationEventsController({ Records: [record("1"), record("2"), record("3")] }, ctx);

    expect(mocked).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "2" }] });
  });

  it("reports a batchItemFailure when the service rejects with a non-Error value", async () => {
    mocked.mockRejectedValueOnce("string rejection");
    const response = await fanOutLocationEventsController({ Records: [record("1")] }, ctx);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("throws ValidationError for a malformed event, without calling the service", async () => {
    await expect(fanOutLocationEventsController({ Records: "nope" }, ctx)).rejects.toBeInstanceOf(ValidationError);
    await expect(fanOutLocationEventsController("nope", ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(mocked).not.toHaveBeenCalled();
  });
});
