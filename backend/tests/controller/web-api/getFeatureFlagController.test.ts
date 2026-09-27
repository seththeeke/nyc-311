import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFeatureFlagController } from "../../../controller/web-api/getFeatureFlagController";
import { getFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { NotFoundError } from "../../../models/errors";
import { flag, httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../service/featureFlag/featureFlagService", () => ({ getFeatureFlag: vi.fn() }));
const mockedGet = vi.mocked(getFeatureFlag);

function event(flagKey?: string): unknown {
  return httpEvent({ method: "GET", path: `/feature-flags/${flagKey}`, pathParameters: flagKey ? { flag_key: flagKey } : undefined });
}

beforeEach(() => {
  mockedGet.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFeatureFlagController", () => {
  it("returns 200 with the flag", async () => {
    mockedGet.mockResolvedValue(flag);
    const response = await getFeatureFlagController(event("COST_MODEL"));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(flag);
    expect(mockedGet).toHaveBeenCalledWith("COST_MODEL");
  });

  it("returns 400 for a malformed event or flag key", async () => {
    expect((await getFeatureFlagController({})).statusCode).toBe(400);
    expect((await getFeatureFlagController(event())).statusCode).toBe(400);
    expect((await getFeatureFlagController(event("bad-key"))).statusCode).toBe(400);
  });

  it("returns 404 when the flag doesn't exist", async () => {
    mockedGet.mockRejectedValue(new NotFoundError("No feature flag MISSING"));
    expect((await getFeatureFlagController(event("MISSING"))).statusCode).toBe(404);
  });

  it("returns 500 for any other failure", async () => {
    mockedGet.mockRejectedValue("boom");
    expect((await getFeatureFlagController(event("COST_MODEL"))).statusCode).toBe(500);
  });
});
