import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { evaluateRequest } from "../../../service/ingestion/requestEvaluationService";
import { requestEvaluationController } from "../../../controller/ingestion/requestEvaluationController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/ingestion/requestEvaluationService", () => ({
  evaluateRequest: vi.fn(),
}));

const mockedEvaluateRequest = vi.mocked(evaluateRequest);
const fakeContext = { awsRequestId: "req-123" } as Context;

const validRequest = {
  request_id: "01REQUEST",
  source: "NYC_311",
  external_unique_key: "69243509",
  location_id: null,
  complaint_type: "Noise - Residential",
  descriptor: "Banging/Pounding",
  agency: "NYPD",
  raw_payload: { unique_key: "69243509" },
  status: "DRAFT",
  created_by: null,
  created_at: "2026-06-05T01:50:27.000",
};

function makeRecord(messageId: string, body: unknown = validRequest): unknown {
  return { messageId, body: JSON.stringify(body) };
}

beforeEach(() => {
  mockedEvaluateRequest.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestEvaluationController", () => {
  it("validates the event, parses each body, and calls the service once per record", async () => {
    const event = { Records: [makeRecord("1"), makeRecord("2")] };

    const response = await requestEvaluationController(event, fakeContext);

    expect(mockedEvaluateRequest).toHaveBeenCalledTimes(2);
    expect(mockedEvaluateRequest).toHaveBeenCalledWith(validRequest);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("returns an empty batchItemFailures list for an empty batch, without calling the service", async () => {
    const response = await requestEvaluationController({ Records: [] }, fakeContext);

    expect(mockedEvaluateRequest).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("reports only the failed record's messageId as a batchItemFailure, and still processes the rest", async () => {
    mockedEvaluateRequest
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("DynamoDB throttled"))
      .mockResolvedValueOnce(undefined);
    const event = { Records: [makeRecord("1"), makeRecord("2"), makeRecord("3")] };

    const response = await requestEvaluationController(event, fakeContext);

    expect(mockedEvaluateRequest).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "2" }] });
  });

  it("reports a batchItemFailure for a message body that isn't valid JSON, without calling the service", async () => {
    const event = { Records: [{ messageId: "1", body: "not-json" }] };

    const response = await requestEvaluationController(event, fakeContext);

    expect(mockedEvaluateRequest).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("reports a batchItemFailure for a body that fails Request validation, without calling the service", async () => {
    const event = { Records: [makeRecord("1", { not: "a request" })] };

    const response = await requestEvaluationController(event, fakeContext);

    expect(mockedEvaluateRequest).not.toHaveBeenCalled();
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("reports a batchItemFailure when the service rejects with a non-Error value", async () => {
    mockedEvaluateRequest.mockRejectedValueOnce("string rejection");
    const event = { Records: [makeRecord("1")] };

    const response = await requestEvaluationController(event, fakeContext);

    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "1" }] });
  });

  it("rejects a malformed event without calling the service", async () => {
    await expect(
      requestEvaluationController({ Records: "not-an-array" }, fakeContext)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockedEvaluateRequest).not.toHaveBeenCalled();
  });

  it("rejects a non-object payload", async () => {
    await expect(requestEvaluationController("not-an-object", fakeContext)).rejects.toBeInstanceOf(ValidationError);
  });
});
