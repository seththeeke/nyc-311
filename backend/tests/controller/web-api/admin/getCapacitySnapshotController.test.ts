import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCapacitySnapshotController } from "../../../../controller/web-api/admin/getCapacitySnapshotController";
import { getCapacitySnapshot } from "../../../../service/capacity/capacitySnapshotService";
import type { CapacitySnapshot } from "../../../../models/capacitySnapshot";

vi.mock("../../../../controller/web-api/admin/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../../service/capacity/capacitySnapshotService", () => ({ getCapacitySnapshot: vi.fn() }));

const snapshot = { fleet: { size: 5 }, median_days_to_resolve_7d: 2.6 } as unknown as CapacitySnapshot;
const event = { rawPath: "/capacity/snapshot", requestContext: { http: { method: "GET" }, authorizer: { jwt: { claims: { sub: "s", email: "coo-agent@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_OPERATIONS]" } } } } };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCapacitySnapshotController", () => {
  it("returns 200 with the snapshot", async () => {
    vi.mocked(getCapacitySnapshot).mockResolvedValue(snapshot);
    const response = await getCapacitySnapshotController(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(snapshot);
  });

  it("returns 400 for a malformed event and 500 when the snapshot fails", async () => {
    expect((await getCapacitySnapshotController({})).statusCode).toBe(400);
    vi.mocked(getCapacitySnapshot).mockRejectedValueOnce(new Error("ddb")).mockRejectedValueOnce("weird");
    expect((await getCapacitySnapshotController(event)).statusCode).toBe(500);
    expect((await getCapacitySnapshotController(event)).statusCode).toBe(500);
  });
});
