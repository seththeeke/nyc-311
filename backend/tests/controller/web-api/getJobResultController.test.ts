import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobResult } from "../../../service/analytics/jobResultService";
import { getJobResultController } from "../../../controller/web-api/getJobResultController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/jobResultService", () => ({ getJobResult: vi.fn() }));
const mocked = vi.mocked(getJobResult);

const ENVELOPE = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [{ name: "stage", type: "varchar" }],
  rows: [{ stage: "SCHEDULE" }],
};

function event(name: string) {
  return {
    rawPath: `/data/jobs/${name}/result`,
    requestContext: { http: { method: "GET" } },
    pathParameters: { name },
  };
}

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getJobResultController", () => {
  it("returns 200 with the resultset envelope", async () => {
    mocked.mockResolvedValue(ENVELOPE);
    const res = await getJobResultController(event("order_volume_by_stage_7d"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual(ENVELOPE);
    expect(mocked).toHaveBeenCalledWith("order_volume_by_stage_7d");
  });

  it("returns 404 when the job has no result yet", async () => {
    mocked.mockResolvedValue(null);
    const res = await getJobResultController(event("order_volume_by_stage_7d"));
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for a malformed event", async () => {
    const res = await getJobResultController({ not: "an-event" });
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or syntactically invalid job name, without calling the service", async () => {
    for (const name of ["Bad-Name", "has space", "UPPER"]) {
      const res = await getJobResultController(event(name));
      expect(res.statusCode).toBe(400);
    }
    const noParam = await getJobResultController({
      rawPath: "/data/jobs//result",
      requestContext: { http: { method: "GET" } },
    });
    expect(noParam.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("s3 unavailable"));
    const res = await getJobResultController(event("order_volume_by_stage_7d"));
    expect(res.statusCode).toBe(500);
  });

  it("maps a ValidationError from the service to 400", async () => {
    mocked.mockRejectedValue(new ValidationError("bad envelope", []));
    const res = await getJobResultController(event("order_volume_by_stage_7d"));
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mocked.mockRejectedValue("string failure");
    const res = await getJobResultController(event("order_volume_by_stage_7d"));
    expect(res.statusCode).toBe(500);
  });
});
