import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlagsApiRouter } from "../../../../controller/web-api/featureFlags/featureFlagsApiRouter";
import { FEATURE_FLAGS_API_ROUTES } from "../../../../controller/web-api/featureFlags/featureFlagsApiRoutes";
import { getFeatureFlagController } from "../../../../controller/web-api/featureFlags/getFeatureFlagController";
import { getTreatmentController } from "../../../../controller/web-api/featureFlags/getTreatmentController";
import { listFeatureFlagsController } from "../../../../controller/web-api/featureFlags/listFeatureFlagsController";

vi.mock("../../../../controller/web-api/featureFlags/getFeatureFlagController", () => ({ getFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/featureFlags/getTreatmentController", () => ({ getTreatmentController: vi.fn() }));
vi.mock("../../../../controller/web-api/featureFlags/listFeatureFlagsController", () => ({ listFeatureFlagsController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof FEATURE_FLAGS_API_ROUTES)[number], unknown> = {
  "GET /feature-flags": listFeatureFlagsController,
  "GET /feature-flags/{flag_key}": getFeatureFlagController,
  "POST /feature-flags/{flag_key}/treatment": getTreatmentController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("featureFlagsApiRouter", () => {
  it("covers exactly its 3 route(s)", () => {
    expect([...FEATURE_FLAGS_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(FEATURE_FLAGS_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await featureFlagsApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await featureFlagsApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
