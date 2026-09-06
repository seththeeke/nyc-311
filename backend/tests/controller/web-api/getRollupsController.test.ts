import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listRollups } from "../../../service/analytics/analyticsRollupsService";
import { getRollupsController } from "../../../controller/web-api/getRollupsController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/analyticsRollupsService", () => ({ listRollups: vi.fn() }));
const mocked = vi.mocked(listRollups);

const validEvent = { rawPath: "/data/rollups", requestContext: { http: { method: "GET" } } };

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRollupsController", () => {
  it("returns 200 with the rollups", async () => {
    mocked.mockResolvedValue({ rollups: [] });
    const res = await getRollupsController(validEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ rollups: [] });
  });

  it("returns 400 for a malformed event", async () => {
    const res = await getRollupsController(null);
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("ddb error"));
    const res = await getRollupsController(validEvent);
    expect(res.statusCode).toBe(500);
  });

  it("maps a ValidationError from the service to 400", async () => {
    mocked.mockRejectedValue(new ValidationError("bad", []));
    const res = await getRollupsController(validEvent);
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mocked.mockRejectedValue("string failure");
    const res = await getRollupsController(validEvent);
    expect(res.statusCode).toBe(500);
  });
});
