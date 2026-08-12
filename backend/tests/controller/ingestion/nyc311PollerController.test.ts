import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { pollNyc311 } from "../../../service/ingestion/nyc311PollerService";
import { nyc311PollerController } from "../../../controller/ingestion/nyc311PollerController";
import { ValidationError } from "../../../models/errors";
import type { PollResult } from "../../../models/pollResult";

vi.mock("../../../service/ingestion/nyc311PollerService", () => ({
  pollNyc311: vi.fn(),
}));

const mockedPollNyc311 = vi.mocked(pollNyc311);
const fakeContext = { awsRequestId: "req-123" } as Context;

beforeEach(() => {
  mockedPollNyc311.mockReset();
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

  it("rejects a non-object trigger payload without calling pollNyc311", async () => {
    await expect(nyc311PollerController("not-an-object", fakeContext)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(mockedPollNyc311).not.toHaveBeenCalled();
  });

  it("lets a service failure propagate (after logging it) so the Lambda on-failure Destination fires", async () => {
    const failure = new Error("SODA API down");
    mockedPollNyc311.mockRejectedValue(failure);

    await expect(nyc311PollerController({}, fakeContext)).rejects.toBe(failure);
  });

  it("still propagates and logs a thrown non-Error value", async () => {
    mockedPollNyc311.mockRejectedValue("string rejection");

    await expect(nyc311PollerController({}, fakeContext)).rejects.toBe("string rejection");
  });
});

describe("module wiring", () => {
  it("throws at load time when REQUESTS_TABLE_NAME is unset", async () => {
    const previous = process.env.REQUESTS_TABLE_NAME;
    delete process.env.REQUESTS_TABLE_NAME;
    vi.resetModules();

    await expect(
      import("../../../controller/ingestion/nyc311PollerController.js")
    ).rejects.toThrow("Missing required environment variable: REQUESTS_TABLE_NAME");

    process.env.REQUESTS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
