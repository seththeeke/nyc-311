import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateWarehouseJobController } from "../../../controller/web-api/updateWarehouseJobController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { updateWarehouseJob } from "../../../service/analytics/warehouseJobDefinitionService";
import { NotFoundError, TerminalError, ValidationError } from "../../../models/errors";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/warehouseJobDefinitionService", () => ({ updateWarehouseJob: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedUpdateWarehouseJob = vi.mocked(updateWarehouseJob);

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

const definition: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  job_type: "SCHEDULED",
  cadence_cron: "cron(0 10 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T00:00:00.000Z",
  created_by: "01ADMIN",
};

function eventWithParamsAndBody(name: string, body: unknown): unknown {
  return {
    rawPath: `/admin/warehouse/jobs/${name}`,
    requestContext: {
      http: { method: "PUT" },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    pathParameters: { name },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedUpdateWarehouseJob.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateWarehouseJobController", () => {
  it("returns 200 with the updated definition", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockResolvedValue(definition);

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(definition);
    expect(mockedUpdateWarehouseJob).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 2", "cron(0 10 * * ? *)");
  });

  it("updates a SAVED_QUERY with no cadence_cron", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockResolvedValue({ ...definition, job_type: "SAVED_QUERY", cadence_cron: undefined, schedule_name: undefined });

    const response = await updateWarehouseJobController(eventWithParamsAndBody("order_volume_by_zip", { sql: "SELECT 2" }));

    expect(response.statusCode).toBe(200);
    expect(mockedUpdateWarehouseJob).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 2", undefined);
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await updateWarehouseJobController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the name path parameter is missing", async () => {
    const response = await updateWarehouseJobController({
      rawPath: "/admin/warehouse/jobs/",
      requestContext: { http: { method: "PUT" } },
      pathParameters: {},
      body: JSON.stringify({ cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" }),
    });

    expect(response.statusCode).toBe(400);
    expect(mockedUpdateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 400 when pathParameters is omitted entirely", async () => {
    const response = await updateWarehouseJobController({
      rawPath: "/admin/warehouse/jobs/",
      requestContext: { http: { method: "PUT" } },
      body: JSON.stringify({ cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" }),
    });

    expect(response.statusCode).toBe(400);
    expect(mockedUpdateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const response = await updateWarehouseJobController({
      rawPath: "/admin/warehouse/jobs/order_volume_by_zip",
      requestContext: { http: { method: "PUT" } },
      pathParameters: { name: "order_volume_by_zip" },
      body: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(mockedUpdateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails schema validation", async () => {
    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "" })
    );

    expect(response.statusCode).toBe(400);
    expect(mockedUpdateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 404 when the job doesn't exist", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockRejectedValue(new NotFoundError('No job named "ghost_job"'));

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("ghost_job", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(404);
  });

  it("returns 409 when the schedule update fails (TerminalError)", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockRejectedValue(new TerminalError("schedule update failed"));

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(409);
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockRejectedValue(new ValidationError("bad input"));

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockRejectedValue(new Error("DynamoDB throttled"));

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(500);
    expect(mockedUpdateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedUpdateWarehouseJob.mockRejectedValue("string rejection");

    const response = await updateWarehouseJobController(
      eventWithParamsAndBody("order_volume_by_zip", { cadence_cron: "cron(0 10 * * ? *)", sql: "SELECT 2" })
    );

    expect(response.statusCode).toBe(500);
  });
});
