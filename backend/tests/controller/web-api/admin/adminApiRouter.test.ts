import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminApiRouter } from "../../../../controller/web-api/admin/adminApiRouter";
import { ADMIN_API_ROUTES, type AdminApiRouteKey } from "../../../../controller/web-api/admin/adminApiRoutes";
import { addCapacityController } from "../../../../controller/web-api/admin/addCapacityController";
import { createFeatureFlagController } from "../../../../controller/web-api/admin/createFeatureFlagController";
import { createWarehouseJobController } from "../../../../controller/web-api/admin/createWarehouseJobController";
import { deleteFeatureFlagController } from "../../../../controller/web-api/admin/deleteFeatureFlagController";
import { deleteWarehouseJobController } from "../../../../controller/web-api/admin/deleteWarehouseJobController";
import { getCapacityController } from "../../../../controller/web-api/admin/getCapacityController";
import { getWarehouseJobSqlController } from "../../../../controller/web-api/admin/getWarehouseJobSqlController";
import { listWarehouseJobRunsController } from "../../../../controller/web-api/admin/listWarehouseJobRunsController";
import { listWarehouseJobsController } from "../../../../controller/web-api/admin/listWarehouseJobsController";
import { postJobRunResultsController } from "../../../../controller/web-api/admin/postJobRunResultsController";
import { removeCapacityController } from "../../../../controller/web-api/admin/removeCapacityController";
import { runAdHocQueryController } from "../../../../controller/web-api/admin/runAdHocQueryController";
import { runSchedulingController } from "../../../../controller/web-api/admin/runSchedulingController";
import { updateFeatureFlagController } from "../../../../controller/web-api/admin/updateFeatureFlagController";
import { updateWarehouseJobController } from "../../../../controller/web-api/admin/updateWarehouseJobController";
import { whoamiController } from "../../../../controller/web-api/admin/whoamiController";

vi.mock("../../../../controller/web-api/admin/addCapacityController", () => ({ addCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/createFeatureFlagController", () => ({ createFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/createWarehouseJobController", () => ({ createWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/deleteFeatureFlagController", () => ({ deleteFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/deleteWarehouseJobController", () => ({ deleteWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/getCapacityController", () => ({ getCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/getWarehouseJobSqlController", () => ({ getWarehouseJobSqlController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/listWarehouseJobRunsController", () => ({ listWarehouseJobRunsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/listWarehouseJobsController", () => ({ listWarehouseJobsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/postJobRunResultsController", () => ({ postJobRunResultsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/removeCapacityController", () => ({ removeCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/runAdHocQueryController", () => ({ runAdHocQueryController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/runSchedulingController", () => ({ runSchedulingController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/updateFeatureFlagController", () => ({ updateFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/updateWarehouseJobController", () => ({ updateWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/whoamiController", () => ({ whoamiController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<AdminApiRouteKey, unknown> = {
  "GET /admin/whoami": whoamiController,
  "GET /capacity": getCapacityController,
  "POST /capacity": addCapacityController,
  "DELETE /capacity/{operator_id}": removeCapacityController,
  "POST /scheduling/run": runSchedulingController,
  "POST /admin/feature-flags": createFeatureFlagController,
  "PUT /admin/feature-flags/{flag_key}": updateFeatureFlagController,
  "DELETE /admin/feature-flags/{flag_key}": deleteFeatureFlagController,
  "POST /admin/warehouse/query": runAdHocQueryController,
  "GET /admin/warehouse/jobs": listWarehouseJobsController,
  "POST /admin/warehouse/jobs": createWarehouseJobController,
  "PUT /admin/warehouse/jobs/{name}": updateWarehouseJobController,
  "DELETE /admin/warehouse/jobs/{name}": deleteWarehouseJobController,
  "GET /admin/warehouse/jobs/{name}/sql": getWarehouseJobSqlController,
  "GET /admin/warehouse/job-runs": listWarehouseJobRunsController,
  "POST /admin/warehouse/job-runs/results": postJobRunResultsController,
};

const CLAIMS = { sub: "abc-123", email: "admin@example.com" };

function eventFor(routeKey: string, claims: Record<string, string> | null = CLAIMS): unknown {
  return {
    routeKey,
    rawPath: "/irrelevant",
    requestContext: {
      http: { method: routeKey.split(" ")[0] },
      ...(claims ? { authorizer: { jwt: { claims } } } : {}),
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("adminApiRouter", () => {
  it("covers exactly the 16 admin routes", () => {
    expect(ADMIN_API_ROUTES).toHaveLength(16);
    expect(new Set(ADMIN_API_ROUTES).size).toBe(16);
  });

  it.each(ADMIN_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = eventFor(routeKey);

    const response = await adminApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 400 for an event with no routeKey", async () => {
    const response = await adminApiRouter({ requestContext: {} });

    expect(response.statusCode).toBe(400);
    expect(whoamiController).not.toHaveBeenCalled();
  });

  it("returns 500 without dispatching when the event has no JWT claims", async () => {
    const response = await adminApiRouter(eventFor("GET /admin/whoami", null));

    expect(response.statusCode).toBe(500);
    expect(whoamiController).not.toHaveBeenCalled();
  });

  it("returns 500 when the claims lack an email", async () => {
    const response = await adminApiRouter(eventFor("GET /admin/whoami", { sub: "abc-123" }));

    expect(response.statusCode).toBe(500);
    expect(whoamiController).not.toHaveBeenCalled();
  });

  it("returns 404 for a route key this bundle doesn't serve", async () => {
    const response = await adminApiRouter(eventFor("GET /feature-flags"));

    expect(response.statusCode).toBe(404);
    for (const controller of Object.values(EXPECTED_CONTROLLERS)) {
      expect(controller).not.toHaveBeenCalled();
    }
  });
});
