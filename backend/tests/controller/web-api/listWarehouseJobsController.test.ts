import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWarehouseJobsController } from "../../../controller/web-api/listWarehouseJobsController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { listWarehouseJobs } from "../../../service/analytics/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/warehouseJobDefinitionService", () => ({ listWarehouseJobs: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedListWarehouseJobs = vi.mocked(listWarehouseJobs);

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

const jobs: WarehouseJobDefinition[] = [
  {
    job_run_id: "DEF#order_volume_by_zip",
    record_type: "DEFINITION",
    job_name: "order_volume_by_zip",
    sql_s3_key: "job-definitions/order_volume_by_zip.sql",
    cadence_cron: "cron(0 9 * * ? *)",
    schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
    created_at: "2026-09-13T00:00:00.000Z",
    created_by: "01ADMIN",
  },
];

const validEvent = {
  rawPath: "/admin/warehouse/jobs",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedListWarehouseJobs.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listWarehouseJobsController", () => {
  it("returns 200 with the job list", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedListWarehouseJobs.mockResolvedValue(jobs);

    const response = await listWarehouseJobsController(validEvent);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ jobs });
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await listWarehouseJobsController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 500 when the service fails", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedListWarehouseJobs.mockRejectedValue(new Error("DynamoDB unavailable"));

    const response = await listWarehouseJobsController(validEvent);

    expect(response.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedListWarehouseJobs.mockRejectedValue("string rejection");

    const response = await listWarehouseJobsController(validEvent);

    expect(response.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await listWarehouseJobsController(validEvent);

    expect(response.statusCode).toBe(500);
    expect(mockedListWarehouseJobs).not.toHaveBeenCalled();
  });
});
