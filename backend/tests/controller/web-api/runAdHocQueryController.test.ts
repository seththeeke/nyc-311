import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdHocQueryController } from "../../../controller/web-api/runAdHocQueryController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { runAdHocQuery } from "../../../service/analytics/adHocQueryService";
import { ValidationError } from "../../../models/errors";
import type { AdHocQueryResult } from "../../../models/adHocQueryResult";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/analytics/adHocQueryService", () => ({ runAdHocQuery: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedRunAdHocQuery = vi.mocked(runAdHocQuery);

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

const result: AdHocQueryResult = {
  columns: [{ name: "borough", type: "varchar" }],
  rows: [{ borough: "BROOKLYN" }],
  row_count: 1,
  truncated: false,
  data_scanned_bytes: 1024,
  engine_execution_time_ms: 250,
};

function eventWithBody(body: unknown): unknown {
  return {
    rawPath: "/admin/warehouse/query",
    requestContext: {
      http: { method: "POST" },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedRunAdHocQuery.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runAdHocQueryController", () => {
  it("returns 200 with the query result", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRunAdHocQuery.mockResolvedValue(result);

    const response = await runAdHocQueryController(eventWithBody({ sql: "SELECT 1" }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(result);
    expect(mockedRunAdHocQuery).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const response = await runAdHocQueryController({ not: "an api gateway event" });

    expect(response.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const response = await runAdHocQueryController({
      rawPath: "/admin/warehouse/query",
      requestContext: { http: { method: "POST" } },
      body: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(mockedRunAdHocQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails schema validation (missing sql)", async () => {
    const response = await runAdHocQueryController(eventWithBody({}));

    expect(response.statusCode).toBe(400);
    expect(mockedRunAdHocQuery).not.toHaveBeenCalled();
  });

  it("defaults a missing body to {} and fails schema validation the same way", async () => {
    const response = await runAdHocQueryController({
      rawPath: "/admin/warehouse/query",
      requestContext: { http: { method: "POST" } },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when the service rejects with a ValidationError (non-read-only statement)", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRunAdHocQuery.mockRejectedValue(new ValidationError("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed"));

    const response = await runAdHocQueryController(eventWithBody({ sql: "DELETE FROM order_events" }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string).message).toContain("SELECT/WITH/SHOW/DESCRIBE/EXPLAIN");
  });

  it("returns 500 with the underlying message for any other failure (e.g. a timeout)", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRunAdHocQuery.mockRejectedValue(new Error("Ad-hoc query timed out after 20000ms — narrow the query and try again"));

    const response = await runAdHocQueryController(eventWithBody({ sql: "SELECT 1" }));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body as string).message).toContain("timed out");
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const response = await runAdHocQueryController(eventWithBody({ sql: "SELECT 1" }));

    expect(response.statusCode).toBe(500);
    expect(mockedRunAdHocQuery).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message when a non-Error value is thrown", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRunAdHocQuery.mockRejectedValue("string rejection");

    const response = await runAdHocQueryController(eventWithBody({ sql: "SELECT 1" }));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body as string).message).toBe("Failed to run query");
  });
});
