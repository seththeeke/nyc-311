import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postJobRunResultsController } from "../../../controller/web-api/postJobRunResultsController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { getJobRunResults } from "../../../service/analytics/jobResultService";
import { ValidationError } from "../../../models/errors";
import type { JobRunResultItem } from "../../../models/jobRunResults";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/jobResultService", () => ({ getJobRunResults: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedGetJobRunResults = vi.mocked(getJobRunResults);

const admin: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-13T00:00:00.000Z",
  updated_at: "2026-09-13T00:00:00.000Z",
  last_active_at: "2026-09-13T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

const results: JobRunResultItem[] = [
  {
    job_run_id: "01A",
    result: {
      job_name: "order_volume_by_stage_7d",
      job_run_id: "01A",
      run_date: "2026-09-07",
      computed_at: "2026-09-07T14:16:36.410Z",
      columns: [{ name: "stage", type: "varchar" }],
      rows: [{ stage: "SCHEDULE" }],
    },
    error: null,
  },
  { job_run_id: "01GHOST", result: null, error: "No result for this job run" },
];

function eventWithBody(body: unknown): unknown {
  return {
    rawPath: "/admin/warehouse/job-runs/results",
    requestContext: {
      http: { method: "POST" },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedGetJobRunResults.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postJobRunResultsController", () => {
  it("returns 200 with the results array", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetJobRunResults.mockResolvedValue(results);

    const response = await postJobRunResultsController(eventWithBody({ job_run_ids: ["01A", "01GHOST"] }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ results });
    expect(mockedGetJobRunResults).toHaveBeenCalledWith(["01A", "01GHOST"]);
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await postJobRunResultsController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const response = await postJobRunResultsController({
      rawPath: "/admin/warehouse/job-runs/results",
      requestContext: { http: { method: "POST" } },
      body: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(mockedGetJobRunResults).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails schema validation (missing job_run_ids)", async () => {
    const response = await postJobRunResultsController(eventWithBody({}));

    expect(response.statusCode).toBe(400);
    expect(mockedGetJobRunResults).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty job_run_ids array", async () => {
    const response = await postJobRunResultsController(eventWithBody({ job_run_ids: [] }));

    expect(response.statusCode).toBe(400);
    expect(mockedGetJobRunResults).not.toHaveBeenCalled();
  });

  it("returns 400 when job_run_ids exceeds the max batch size", async () => {
    const response = await postJobRunResultsController(
      eventWithBody({ job_run_ids: Array.from({ length: 26 }, (_, i) => `01ID${i}`) })
    );

    expect(response.statusCode).toBe(400);
    expect(mockedGetJobRunResults).not.toHaveBeenCalled();
  });

  it("defaults a missing body to {} and fails schema validation the same way", async () => {
    const response = await postJobRunResultsController({
      rawPath: "/admin/warehouse/job-runs/results",
      requestContext: { http: { method: "POST" } },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when the service rejects with a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetJobRunResults.mockRejectedValue(new ValidationError("bad input"));

    const response = await postJobRunResultsController(eventWithBody({ job_run_ids: ["01A"] }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string).message).toBe("bad input");
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await postJobRunResultsController(eventWithBody({ job_run_ids: ["01A"] }));

    expect(response.statusCode).toBe(500);
    expect(mockedGetJobRunResults).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message when a non-Error value is thrown", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetJobRunResults.mockRejectedValue("string rejection");

    const response = await postJobRunResultsController(eventWithBody({ job_run_ids: ["01A"] }));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body as string).message).toBe("Failed to load job run results");
  });
});
