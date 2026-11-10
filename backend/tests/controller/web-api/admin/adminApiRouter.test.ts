import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminApiRouter } from "../../../../controller/web-api/admin/adminApiRouter";
import { ADMIN_API_ROUTES, type AdminApiRouteKey } from "../../../../controller/web-api/admin/adminApiRoutes";
import { addCapacityController } from "../../../../controller/web-api/admin/addCapacityController";
import { createFeatureFlagController } from "../../../../controller/web-api/admin/createFeatureFlagController";
import { createWarehouseJobController } from "../../../../controller/web-api/admin/createWarehouseJobController";
import { deleteFeatureFlagController } from "../../../../controller/web-api/admin/deleteFeatureFlagController";
import { deleteWarehouseJobController } from "../../../../controller/web-api/admin/deleteWarehouseJobController";
import { getCapacityController } from "../../../../controller/web-api/admin/getCapacityController";
import { getCapacitySnapshotController } from "../../../../controller/web-api/admin/getCapacitySnapshotController";
import { getWarehouseJobSqlController } from "../../../../controller/web-api/admin/getWarehouseJobSqlController";
import { listWarehouseJobRunsController } from "../../../../controller/web-api/admin/listWarehouseJobRunsController";
import { listWarehouseJobsController } from "../../../../controller/web-api/admin/listWarehouseJobsController";
import { postJobRunResultsController } from "../../../../controller/web-api/admin/postJobRunResultsController";
import { removeCapacityController } from "../../../../controller/web-api/admin/removeCapacityController";
import { runAdHocQueryController } from "../../../../controller/web-api/admin/runAdHocQueryController";
import { updateContactController } from "../../../../controller/web-api/admin/updateContactController";
import { updateFeatureFlagController } from "../../../../controller/web-api/admin/updateFeatureFlagController";
import { updateWarehouseJobController } from "../../../../controller/web-api/admin/updateWarehouseJobController";
import { whoamiController } from "../../../../controller/web-api/admin/whoamiController";

vi.mock("../../../../controller/web-api/admin/addCapacityController", () => ({ addCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/createFeatureFlagController", () => ({ createFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/createWarehouseJobController", () => ({ createWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/deleteFeatureFlagController", () => ({ deleteFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/deleteWarehouseJobController", () => ({ deleteWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/getCapacityController", () => ({ getCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/getCapacitySnapshotController", () => ({ getCapacitySnapshotController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/getWarehouseJobSqlController", () => ({ getWarehouseJobSqlController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/listWarehouseJobRunsController", () => ({ listWarehouseJobRunsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/listWarehouseJobsController", () => ({ listWarehouseJobsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/postJobRunResultsController", () => ({ postJobRunResultsController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/removeCapacityController", () => ({ removeCapacityController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/runAdHocQueryController", () => ({ runAdHocQueryController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/updateContactController", () => ({ updateContactController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/updateFeatureFlagController", () => ({ updateFeatureFlagController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/updateWarehouseJobController", () => ({ updateWarehouseJobController: vi.fn() }));
vi.mock("../../../../controller/web-api/admin/whoamiController", () => ({ whoamiController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<AdminApiRouteKey, unknown> = {
  "GET /admin/whoami": whoamiController,
  "GET /capacity": getCapacityController,
  "GET /capacity/snapshot": getCapacitySnapshotController,
  "POST /capacity": addCapacityController,
  "DELETE /capacity/{operator_id}": removeCapacityController,
  "PATCH /admin/contacts/{contact_id}": updateContactController,
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

const CLAIMS = { sub: "abc-123", email: "admin@example.com", "cognito:groups": "[ADMIN BOROUGH_SIM_TEAM]" };

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
  it("covers exactly the 17 admin routes", () => {
    expect(ADMIN_API_ROUTES).toHaveLength(17);
    expect(new Set(ADMIN_API_ROUTES).size).toBe(17);
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

  it("returns 403 without dispatching when the caller isn't in the route's groups", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await adminApiRouter(eventFor("GET /admin/whoami", { sub: "s", email: "agent@example.com", "cognito:groups": "[BOROUGH_SIM_TEAM]" }));
    expect(response.statusCode).toBe(403);
    expect(whoamiController).not.toHaveBeenCalled();
  });

  it("lets the product group update a contact and query the warehouse, and nothing else", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(updateContactController).mockResolvedValue({ statusCode: 200, body: "{}" });
    vi.mocked(runAdHocQueryController).mockResolvedValue({ statusCode: 200, body: "{}" });
    const product = { sub: "s", email: "cpo-agent@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_PRODUCT]" };
    expect((await adminApiRouter(eventFor("PATCH /admin/contacts/{contact_id}", product))).statusCode).toBe(200);
    expect((await adminApiRouter(eventFor("POST /admin/warehouse/query", product))).statusCode).toBe(200);
    expect((await adminApiRouter(eventFor("POST /admin/warehouse/jobs", product))).statusCode).toBe(403);
    expect((await adminApiRouter(eventFor("POST /capacity", product))).statusCode).toBe(403);
    expect((await adminApiRouter(eventFor("GET /capacity/snapshot", product))).statusCode).toBe(403);
    const operations = { sub: "s", email: "coo-agent@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_OPERATIONS]" };
    expect((await adminApiRouter(eventFor("PATCH /admin/contacts/{contact_id}", operations))).statusCode).toBe(403);
  });

  it("lets the engineering group query the warehouse and update a flag, and nothing else", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(runAdHocQueryController).mockResolvedValue({ statusCode: 200, body: "{}" });
    vi.mocked(updateFeatureFlagController).mockResolvedValue({ statusCode: 200, body: "{}" });
    const engineering = { sub: "s", email: "gen-purpose-dev@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_ENGINEERING]" };
    expect((await adminApiRouter(eventFor("POST /admin/warehouse/query", engineering))).statusCode).toBe(200);
    expect((await adminApiRouter(eventFor("PUT /admin/feature-flags/{flag_key}", engineering))).statusCode).toBe(200);
    for (const routeKey of ["POST /admin/feature-flags", "DELETE /admin/feature-flags/{flag_key}", "PATCH /admin/contacts/{contact_id}", "POST /capacity", "GET /admin/warehouse/job-runs"]) {
      expect((await adminApiRouter(eventFor(routeKey, engineering))).statusCode).toBe(403);
    }
    const product = { sub: "s", email: "cpo-agent@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_PRODUCT]" };
    expect((await adminApiRouter(eventFor("PUT /admin/feature-flags/{flag_key}", product))).statusCode).toBe(403);
  });

  it("returns 403 when the caller holds no groups at all", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await adminApiRouter(eventFor("GET /admin/whoami", { sub: "s", email: "agent@example.com" }));
    expect(response.statusCode).toBe(403);
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
