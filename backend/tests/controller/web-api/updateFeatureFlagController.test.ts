import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateFeatureFlagController } from "../../../controller/web-api/updateFeatureFlagController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { updateFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { NotFoundError, TerminalError, ValidationError } from "../../../models/errors";
import { admin, flag, flagInput, httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/featureFlag/featureFlagService", () => ({ updateFeatureFlag: vi.fn() }));
const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedUpdate = vi.mocked(updateFeatureFlag);

function event(flagKey: string | undefined, body: string | null): unknown {
  return httpEvent({
    method: "PUT",
    path: `/admin/feature-flags/${flagKey}`,
    pathParameters: flagKey ? { flag_key: flagKey } : undefined,
    body,
  });
}
const validBody = JSON.stringify({ expected_version: 1, ...flagInput });

beforeEach(() => {
  mockedRequireAdminUser.mockReset().mockResolvedValue(admin);
  mockedUpdate.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateFeatureFlagController", () => {
  it("returns 200 with the updated flag", async () => {
    const updated = { ...flag, version: 2 };
    mockedUpdate.mockResolvedValue(updated);
    const response = await updateFeatureFlagController(event("COST_MODEL", validBody));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(updated);
    expect(mockedUpdate).toHaveBeenCalledWith("COST_MODEL", { expected_version: 1, ...flagInput }, "01ADMIN");
  });

  it("returns 400 for a malformed event, key, JSON, or body", async () => {
    expect((await updateFeatureFlagController({})).statusCode).toBe(400);
    expect((await updateFeatureFlagController(event(undefined, validBody))).statusCode).toBe(400);
    expect((await updateFeatureFlagController(event("COST_MODEL", "{nope"))).statusCode).toBe(400);
    expect((await updateFeatureFlagController(event("COST_MODEL", null))).statusCode).toBe(400);
    expect((await updateFeatureFlagController(event("COST_MODEL", JSON.stringify(flagInput)))).statusCode).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("maps service errors to 404 / 400 / 409 / 500", async () => {
    mockedUpdate
      .mockRejectedValueOnce(new NotFoundError("missing"))
      .mockRejectedValueOnce(new ValidationError("bad"))
      .mockRejectedValueOnce(new TerminalError("stale"))
      .mockRejectedValueOnce("boom");
    expect((await updateFeatureFlagController(event("COST_MODEL", validBody))).statusCode).toBe(404);
    expect((await updateFeatureFlagController(event("COST_MODEL", validBody))).statusCode).toBe(400);
    const conflict = await updateFeatureFlagController(event("COST_MODEL", validBody));
    expect(conflict.statusCode).toBe(409);
    expect(JSON.parse(conflict.body as string).message).toContain("version 1");
    expect((await updateFeatureFlagController(event("COST_MODEL", validBody))).statusCode).toBe(500);
  });
});
