import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWarehouseJobRunsController } from "../../../../controller/web-api/admin/listWarehouseJobRunsController";
import { requireAdminUser } from "../../../../controller/web-api/admin/requireAdminUser";
import { listWarehouseJobRuns } from "../../../../service/analytics/warehouseJobRunsService";
import { TerminalError, ValidationError } from "../../../../models/errors";
import type { User } from "../../../../models/user";

vi.mock("../../../../controller/web-api/admin/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../../service/analytics/warehouseJobRunsService", () => ({ listWarehouseJobRuns: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedListWarehouseJobRuns = vi.mocked(listWarehouseJobRuns);

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

const validEvent = {
  rawPath: "/admin/warehouse/job-runs",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedRequireAdminUser.mockResolvedValue(admin);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("listWarehouseJobRunsController", () => {
  it("resolves the admin user, then returns 200 with the job runs", async () => {
    mockedListWarehouseJobRuns.mockResolvedValue({ jobRuns: [] });

    const res = await listWarehouseJobRunsController(validEvent);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ jobRuns: [] });
    expect(mockedRequireAdminUser).toHaveBeenCalledOnce();
  });

  it("returns 400 for a malformed event without touching the service", async () => {
    const res = await listWarehouseJobRunsController({});

    expect(res.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
    expect(mockedListWarehouseJobRuns).not.toHaveBeenCalled();
  });

  it("returns 500 without listing when the admin user can't be resolved", async () => {
    mockedRequireAdminUser.mockRejectedValue(new TerminalError("Missing sub/email claims"));

    const res = await listWarehouseJobRunsController(validEvent);

    expect(res.statusCode).toBe(500);
    expect(mockedListWarehouseJobRuns).not.toHaveBeenCalled();
  });

  it("maps a ValidationError from the service to 400", async () => {
    mockedListWarehouseJobRuns.mockRejectedValue(new ValidationError("bad", []));

    expect((await listWarehouseJobRunsController(validEvent)).statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mockedListWarehouseJobRuns.mockRejectedValue("string failure");

    expect((await listWarehouseJobRunsController(validEvent)).statusCode).toBe(500);
  });
});
