import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWarehouseJobRuns } from "../../../service/analytics/warehouseJobRunsService";
import { getWarehouseJobRunsController } from "../../../controller/web-api/getWarehouseJobRunsController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/warehouseJobRunsService", () => ({ listWarehouseJobRuns: vi.fn() }));
const mocked = vi.mocked(listWarehouseJobRuns);

const validEvent = { rawPath: "/data/jobs", requestContext: { http: { method: "GET" } } };

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWarehouseJobRunsController", () => {
  it("returns 200 with the job runs", async () => {
    mocked.mockResolvedValue({ jobRuns: [] });
    const res = await getWarehouseJobRunsController(validEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ jobRuns: [] });
  });

  it("returns 400 for a malformed event", async () => {
    const res = await getWarehouseJobRunsController({});
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("ddb error"));
    const res = await getWarehouseJobRunsController(validEvent);
    expect(res.statusCode).toBe(500);
  });

  it("maps a ValidationError from the service to 400", async () => {
    mocked.mockRejectedValue(new ValidationError("bad", []));
    const res = await getWarehouseJobRunsController(validEvent);
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mocked.mockRejectedValue("string failure");
    const res = await getWarehouseJobRunsController(validEvent);
    expect(res.statusCode).toBe(500);
  });
});
