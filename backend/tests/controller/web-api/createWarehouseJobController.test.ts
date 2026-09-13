import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWarehouseJobController } from "../../../controller/web-api/createWarehouseJobController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { createWarehouseJob } from "../../../service/analytics/warehouseJobDefinitionService";
import { TerminalError, ValidationError } from "../../../models/errors";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/warehouseJobDefinitionService", () => ({ createWarehouseJob: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedCreateWarehouseJob = vi.mocked(createWarehouseJob);

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
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T00:00:00.000Z",
  created_by: "01ADMIN",
};

function eventWithBody(body: unknown): unknown {
  return {
    rawPath: "/admin/warehouse/jobs",
    requestContext: {
      http: { method: "POST" },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedCreateWarehouseJob.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createWarehouseJobController", () => {
  it("returns 201 with the created definition", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedCreateWarehouseJob.mockResolvedValue(definition);

    const response = await createWarehouseJobController(
      eventWithBody({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body as string)).toEqual(definition);
    expect(mockedCreateWarehouseJob).toHaveBeenCalledWith(
      "order_volume_by_zip",
      "cron(0 9 * * ? *)",
      "SELECT 1",
      "01ADMIN"
    );
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await createWarehouseJobController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const response = await createWarehouseJobController({
      rawPath: "/admin/warehouse/jobs",
      requestContext: { http: { method: "POST" } },
      body: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(mockedCreateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails schema validation", async () => {
    const response = await createWarehouseJobController(eventWithBody({ name: "Bad-Name" }));

    expect(response.statusCode).toBe(400);
    expect(mockedCreateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 409 on a name collision (TerminalError)", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedCreateWarehouseJob.mockRejectedValue(new TerminalError('A job named "x" already exists'));

    const response = await createWarehouseJobController(
      eventWithBody({ name: "x", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(409);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedCreateWarehouseJob.mockRejectedValue(new Error("DynamoDB throttled"));

    const response = await createWarehouseJobController(
      eventWithBody({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(500);
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedCreateWarehouseJob.mockRejectedValue(new ValidationError("bad input"));

    const response = await createWarehouseJobController(
      eventWithBody({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(400);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await createWarehouseJobController(
      eventWithBody({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(500);
    expect(mockedCreateWarehouseJob).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedCreateWarehouseJob.mockRejectedValue("string rejection");

    const response = await createWarehouseJobController(
      eventWithBody({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" })
    );

    expect(response.statusCode).toBe(500);
  });
});
