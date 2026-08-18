import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { pollNyc311, recordPollerMetrics } from "../../../service/ingestion/nyc311RequestService";
import { nyc311PollerController } from "../../../controller/ingestion/nyc311PollerController";
import { ValidationError } from "../../../models/errors";
import type { PollResult } from "../../../models/pollResult";

vi.mock("../../../service/ingestion/nyc311RequestService", () => ({
  pollNyc311: vi.fn(),
  recordPollerMetrics: vi.fn(),
}));

const mockedPollNyc311 = vi.mocked(pollNyc311);
const mockedRecordPollerMetrics = vi.mocked(recordPollerMetrics);
const fakeContext = { awsRequestId: "req-123" } as Context;

beforeEach(() => {
  mockedPollNyc311.mockReset();
  mockedRecordPollerMetrics.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("nyc311PollerController", () => {
  it("validates the trigger payload, calls pollNyc311, and returns its result", async () => {
    const result: PollResult = { recordsIngested: 3, duplicatesSkipped: 1, recordsRejected: 0 };
    mockedPollNyc311.mockResolvedValue(result);

    await expect(nyc311PollerController({}, fakeContext)).resolves.toEqual(result);
    expect(mockedPollNyc311).toHaveBeenCalledTimes(1);
  });

  it("records a success metrics row via the service, with the poll result's counts", async () => {
    const result: PollResult = { recordsIngested: 3, duplicatesSkipped: 1, recordsRejected: 0 };
    mockedPollNyc311.mockResolvedValue(result);

    await nyc311PollerController({}, fakeContext);

    expect(mockedRecordPollerMetrics).toHaveBeenCalledTimes(1);
    expect(mockedRecordPollerMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        records_ingested: 3,
        duplicates_skipped: 1,
        records_rejected: 0,
        error_message: null,
      })
    );
  });

  it("rejects a non-object trigger payload without calling pollNyc311 or recording metrics", async () => {
    await expect(nyc311PollerController("not-an-object", fakeContext)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(mockedPollNyc311).not.toHaveBeenCalled();
    expect(mockedRecordPollerMetrics).not.toHaveBeenCalled();
  });

  it("lets a service failure propagate (after logging it) so the Lambda on-failure Destination fires", async () => {
    const failure = new Error("SODA API down");
    mockedPollNyc311.mockRejectedValue(failure);

    await expect(nyc311PollerController({}, fakeContext)).rejects.toBe(failure);
  });

  it("records a zeroed, failed metrics row via the service with the error message on a service failure", async () => {
    mockedPollNyc311.mockRejectedValue(new Error("SODA API down"));

    await expect(nyc311PollerController({}, fakeContext)).rejects.toThrow("SODA API down");

    expect(mockedRecordPollerMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        records_ingested: 0,
        duplicates_skipped: 0,
        records_rejected: 0,
        error_message: "SODA API down",
      })
    );
  });

  it("still propagates and logs a thrown non-Error value", async () => {
    mockedPollNyc311.mockRejectedValue("string rejection");

    await expect(nyc311PollerController({}, fakeContext)).rejects.toBe("string rejection");
    expect(mockedRecordPollerMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error_message: "string rejection" })
    );
  });

  it("still propagates the original failure even if recording the failure metrics itself fails", async () => {
    const failure = new Error("SODA API down");
    mockedPollNyc311.mockRejectedValue(failure);
    mockedRecordPollerMetrics.mockRejectedValue(new Error("DynamoDB throttled"));

    await expect(nyc311PollerController({}, fakeContext)).rejects.toBe(failure);
  });

  it("does not fail the invocation if recording the success metrics itself fails", async () => {
    const result: PollResult = { recordsIngested: 3, duplicatesSkipped: 1, recordsRejected: 0 };
    mockedPollNyc311.mockResolvedValue(result);
    mockedRecordPollerMetrics.mockRejectedValue(new Error("DynamoDB throttled"));

    await expect(nyc311PollerController({}, fakeContext)).resolves.toEqual(result);
  });

  it("logs a non-Error rejection from the metrics write without throwing", async () => {
    const result: PollResult = { recordsIngested: 3, duplicatesSkipped: 1, recordsRejected: 0 };
    mockedPollNyc311.mockResolvedValue(result);
    mockedRecordPollerMetrics.mockRejectedValue("write failed");

    await expect(nyc311PollerController({}, fakeContext)).resolves.toEqual(result);
  });
});
