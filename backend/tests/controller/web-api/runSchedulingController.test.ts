import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSchedulingController } from "../../../controller/web-api/runSchedulingController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { scheduleOrders } from "../../../service/scheduling/orderSchedulingService";
import { ValidationError } from "../../../models/errors";
import type { SchedulingRunSummary } from "../../../service/scheduling/orderSchedulingService";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/scheduling/orderSchedulingService", () => ({ scheduleOrders: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedScheduleOrders = vi.mocked(scheduleOrders);

const admin: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

const summary: SchedulingRunSummary = { ordersConsidered: 3, ordersScheduled: 2, ordersSkippedNoCapacity: 1, ordersFailed: 0 };

const validEvent = {
  rawPath: "/scheduling/run",
  requestContext: {
    http: { method: "POST" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedScheduleOrders.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSchedulingController", () => {
  it("returns 200 with the SchedulingRunSummary", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedScheduleOrders.mockResolvedValue(summary);

    const result = await runSchedulingController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(summary);
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const result = await runSchedulingController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedScheduleOrders.mockRejectedValue(new ValidationError("bad trigger"));

    const result = await runSchedulingController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedScheduleOrders.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await runSchedulingController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const result = await runSchedulingController(validEvent);

    expect(result.statusCode).toBe(500);
    expect(mockedScheduleOrders).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedScheduleOrders.mockRejectedValue("string rejection");

    const result = await runSchedulingController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
