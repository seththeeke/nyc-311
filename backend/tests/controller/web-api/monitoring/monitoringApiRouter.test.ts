import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monitoringApiRouter } from "../../../../controller/web-api/monitoring/monitoringApiRouter";
import { MONITORING_API_ROUTES } from "../../../../controller/web-api/monitoring/monitoringApiRoutes";
import { getLambdaMetricsController } from "../../../../controller/web-api/monitoring/getLambdaMetricsController";
import { getPollerMetricsController } from "../../../../controller/web-api/monitoring/getPollerMetricsController";
import { getPublicApiMetricsController } from "../../../../controller/web-api/monitoring/getPublicApiMetricsController";

vi.mock("../../../../controller/web-api/monitoring/getLambdaMetricsController", () => ({ getLambdaMetricsController: vi.fn() }));
vi.mock("../../../../controller/web-api/monitoring/getPollerMetricsController", () => ({ getPollerMetricsController: vi.fn() }));
vi.mock("../../../../controller/web-api/monitoring/getPublicApiMetricsController", () => ({ getPublicApiMetricsController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof MONITORING_API_ROUTES)[number], unknown> = {
  "GET /ingestion/metrics": getPollerMetricsController,
  "GET /lambda-metrics": getLambdaMetricsController,
  "GET /public-api/metrics": getPublicApiMetricsController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("monitoringApiRouter", () => {
  it("covers exactly its 3 route(s)", () => {
    expect([...MONITORING_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(MONITORING_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await monitoringApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await monitoringApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
