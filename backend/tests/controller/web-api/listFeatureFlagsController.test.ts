import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listFeatureFlagsController } from "../../../controller/web-api/listFeatureFlagsController";
import { listFeatureFlags } from "../../../service/featureFlag/featureFlagService";
import { flag, httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../service/featureFlag/featureFlagService", () => ({ listFeatureFlags: vi.fn() }));
const mockedList = vi.mocked(listFeatureFlags);

beforeEach(() => {
  mockedList.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listFeatureFlagsController", () => {
  it("returns 200 with the flags", async () => {
    mockedList.mockResolvedValue([flag]);
    const response = await listFeatureFlagsController(httpEvent({ method: "GET", path: "/feature-flags" }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ flags: [flag] });
  });

  it("returns 400 for a malformed event", async () => {
    expect((await listFeatureFlagsController({})).statusCode).toBe(400);
  });

  it("returns 500 when the service fails", async () => {
    mockedList.mockRejectedValue(new Error("boom"));
    const response = await listFeatureFlagsController(httpEvent({ method: "GET", path: "/feature-flags" }));
    expect(response.statusCode).toBe(500);
  });

  it("logs non-Error failures too", async () => {
    mockedList.mockRejectedValue("boom");
    const response = await listFeatureFlagsController(httpEvent({ method: "GET", path: "/feature-flags" }));
    expect(response.statusCode).toBe(500);
  });
});
