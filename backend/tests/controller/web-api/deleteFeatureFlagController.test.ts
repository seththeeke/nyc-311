import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteFeatureFlagController } from "../../../controller/web-api/deleteFeatureFlagController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { deleteFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { NotFoundError } from "../../../models/errors";
import { admin, httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/featureFlag/featureFlagService", () => ({ deleteFeatureFlag: vi.fn() }));
const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedDelete = vi.mocked(deleteFeatureFlag);

function event(flagKey?: string): unknown {
  return httpEvent({
    method: "DELETE",
    path: `/admin/feature-flags/${flagKey}`,
    pathParameters: flagKey ? { flag_key: flagKey } : undefined,
  });
}

beforeEach(() => {
  mockedRequireAdminUser.mockReset().mockResolvedValue(admin);
  mockedDelete.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteFeatureFlagController", () => {
  it("returns 204 on success", async () => {
    mockedDelete.mockResolvedValue(undefined);
    const response = await deleteFeatureFlagController(event("COST_MODEL"));
    expect(response.statusCode).toBe(204);
    expect(mockedDelete).toHaveBeenCalledWith("COST_MODEL", "01ADMIN");
  });

  it("returns 400 for a malformed event or key", async () => {
    expect((await deleteFeatureFlagController({})).statusCode).toBe(400);
    expect((await deleteFeatureFlagController(event())).statusCode).toBe(400);
  });

  it("returns 404 when missing and 500 otherwise", async () => {
    mockedDelete.mockRejectedValueOnce(new NotFoundError("missing")).mockRejectedValueOnce("boom");
    expect((await deleteFeatureFlagController(event("MISSING"))).statusCode).toBe(404);
    expect((await deleteFeatureFlagController(event("COST_MODEL"))).statusCode).toBe(500);
  });
});
