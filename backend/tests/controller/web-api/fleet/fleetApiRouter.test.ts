import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fleetApiRouter } from "../../../../controller/web-api/fleet/fleetApiRouter";
import { FLEET_API_ROUTES } from "../../../../controller/web-api/fleet/fleetApiRoutes";
import { getFleetLocationsController } from "../../../../controller/web-api/fleet/getFleetLocationsController";

vi.mock("../../../../controller/web-api/fleet/getFleetLocationsController", () => ({ getFleetLocationsController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof FLEET_API_ROUTES)[number], unknown> = {
  "GET /fleet/locations": getFleetLocationsController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("fleetApiRouter", () => {
  it("covers exactly its 1 route(s)", () => {
    expect([...FLEET_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(FLEET_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await fleetApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await fleetApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
