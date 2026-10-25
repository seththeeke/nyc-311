import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataApiRouter } from "../../../../controller/web-api/data/dataApiRouter";
import { DATA_API_ROUTES } from "../../../../controller/web-api/data/dataApiRoutes";
import { getWarehouseSchemaController } from "../../../../controller/web-api/data/getWarehouseSchemaController";
import { getWorkspaceMetricsController } from "../../../../controller/web-api/data/getWorkspaceMetricsController";

vi.mock("../../../../controller/web-api/data/getWarehouseSchemaController", () => ({ getWarehouseSchemaController: vi.fn() }));
vi.mock("../../../../controller/web-api/data/getWorkspaceMetricsController", () => ({ getWorkspaceMetricsController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof DATA_API_ROUTES)[number], unknown> = {
  "GET /data/schema": getWarehouseSchemaController,
  "GET /workspace/metrics": getWorkspaceMetricsController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("dataApiRouter", () => {
  it("covers exactly its 2 route(s)", () => {
    expect([...DATA_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(DATA_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await dataApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await dataApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
