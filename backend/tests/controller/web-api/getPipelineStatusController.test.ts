import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPipelineStatus } from "../../../service/pipeline/pipelineStatusService";
import { getPipelineStatusController } from "../../../controller/web-api/getPipelineStatusController";
import { ValidationError } from "../../../models/errors";
import type { PipelineStatusResponse } from "../../../models/pipelineStatus";

vi.mock("../../../service/pipeline/pipelineStatusService", () => ({
  getPipelineStatus: vi.fn(),
}));

const mockedGetPipelineStatus = vi.mocked(getPipelineStatus);

const validEvent = {
  rawPath: "/pipeline/status",
  requestContext: { http: { method: "GET" } },
};

const status: PipelineStatusResponse = {
  pipelineName: "Nyc311Pipeline",
  stages: [{ stageName: "Build", actions: [] }],
  executions: [],
};

beforeEach(() => {
  mockedGetPipelineStatus.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPipelineStatusController", () => {
  it("validates the event, calls getPipelineStatus, and returns 200 with the status", async () => {
    mockedGetPipelineStatus.mockResolvedValue(status);

    const result = await getPipelineStatusController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual(status);
  });

  it("returns 400 without calling getPipelineStatus for a malformed event", async () => {
    const result = await getPipelineStatusController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedGetPipelineStatus).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedGetPipelineStatus.mockRejectedValue(new ValidationError("bad response shape"));

    const result = await getPipelineStatusController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedGetPipelineStatus.mockRejectedValue(new Error("CodePipeline throttled"));

    const result = await getPipelineStatusController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedGetPipelineStatus.mockRejectedValue("string rejection");

    const result = await getPipelineStatusController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
