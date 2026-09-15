import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWarehouseJobSqlController } from "../../../controller/web-api/getWarehouseJobSqlController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { getWarehouseJobSql } from "../../../service/analytics/warehouseJobDefinitionService";
import { NotFoundError, ValidationError } from "../../../models/errors";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/warehouseJobDefinitionService", () => ({ getWarehouseJobSql: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedGetWarehouseJobSql = vi.mocked(getWarehouseJobSql);

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

function eventWithParams(name: string): unknown {
  return {
    rawPath: `/admin/warehouse/jobs/${name}/sql`,
    requestContext: {
      http: { method: "GET" },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    pathParameters: { name },
  };
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedGetWarehouseJobSql.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWarehouseJobSqlController", () => {
  it("returns 200 with the job's SQL text", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetWarehouseJobSql.mockResolvedValue("SELECT 1");

    const response = await getWarehouseJobSqlController(eventWithParams("order_volume_by_zip"));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ sql: "SELECT 1" });
    expect(mockedGetWarehouseJobSql).toHaveBeenCalledWith("order_volume_by_zip");
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await getWarehouseJobSqlController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the name path parameter is missing", async () => {
    const response = await getWarehouseJobSqlController({
      rawPath: "/admin/warehouse/jobs//sql",
      requestContext: { http: { method: "GET" } },
      pathParameters: {},
    });

    expect(response.statusCode).toBe(400);
    expect(mockedGetWarehouseJobSql).not.toHaveBeenCalled();
  });

  it("returns 400 when pathParameters is omitted entirely", async () => {
    const response = await getWarehouseJobSqlController({
      rawPath: "/admin/warehouse/jobs//sql",
      requestContext: { http: { method: "GET" } },
    });

    expect(response.statusCode).toBe(400);
    expect(mockedGetWarehouseJobSql).not.toHaveBeenCalled();
  });

  it("returns 404 when the job doesn't exist", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetWarehouseJobSql.mockRejectedValue(new NotFoundError('No job named "ghost_job"'));

    const response = await getWarehouseJobSqlController(eventWithParams("ghost_job"));

    expect(response.statusCode).toBe(404);
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetWarehouseJobSql.mockRejectedValue(new ValidationError("bad input"));

    const response = await getWarehouseJobSqlController(eventWithParams("order_volume_by_zip"));

    expect(response.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetWarehouseJobSql.mockRejectedValue(new Error("S3 unavailable"));

    const response = await getWarehouseJobSqlController(eventWithParams("order_volume_by_zip"));

    expect(response.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await getWarehouseJobSqlController(eventWithParams("order_volume_by_zip"));

    expect(response.statusCode).toBe(500);
    expect(mockedGetWarehouseJobSql).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetWarehouseJobSql.mockRejectedValue("string rejection");

    const response = await getWarehouseJobSqlController(eventWithParams("order_volume_by_zip"));

    expect(response.statusCode).toBe(500);
  });
});
