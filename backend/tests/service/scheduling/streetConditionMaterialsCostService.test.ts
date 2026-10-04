import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streetConditionMaterialsCostEstimator } from "../../../service/scheduling/streetConditionMaterialsCostService";
import type { Order } from "../../../models/order";
import type { Request } from "../../../models/request";

const ORDER = { order_id: "01ORDER" } as Order;

function makeRequest(descriptor: string | null): Request {
  return {
    request_id: "01REQUEST",
    source: "NYC_311",
    external_unique_key: "ext-1",
    location_id: "1234567890",
    complaint_type: "Street Condition",
    descriptor,
    agency: "DOT",
    raw_payload: {},
    status: "PROMOTED",
    created_by: null,
    created_at: "2026-08-20T00:00:00.000Z",
  };
}

/* The v1 table from v1-prod-deployment.md Q5 — every Street Condition descriptor seen Jul–Sep 2026. */
const EXPECTED: [string, number][] = [
  ["Pothole", 75],
  ["Cave-in", 600],
  ["Defective Hardware", 250],
  ["Rough, Pitted or Cracked Roads", 400],
  ["Failed Street Repair", 200],
  ["Plate Condition - Noisy", 50],
  ["Plate Condition - Shifted", 50],
  ["Plate Condition - Open", 50],
  ["Plate Condition - Anti-Skid", 50],
  ["Line/Marking - Faded", 150],
  ["Line/Marking - After Repaving", 150],
  ["Crash Cushion Defect", 500],
  ["Guard Rail - Street", 500],
  ["Blocked - Construction", 0],
  ["Dumpster - Construction Waste", 0],
  ["Unsafe Worksite", 0],
  ["Depression Maintenance", 200],
  ["Wear & Tear", 200],
  ["Hummock", 200],
  ["General Bad Condition", 200],
];

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streetConditionMaterialsCostEstimator", () => {
  it.each(EXPECTED)("returns the constant expectation for %s (%d USD)", async (descriptor, expected) => {
    await expect(streetConditionMaterialsCostEstimator.estimateCost(ORDER, makeRequest(descriptor))).resolves.toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the generic repair profile and logs UnknownDescriptor for a new descriptor", async () => {
    await expect(streetConditionMaterialsCostEstimator.estimateCost(ORDER, makeRequest("Brand New Descriptor"))).resolves.toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("UnknownDescriptor");
    expect(String(warn.mock.calls[0]?.[0])).toContain("MATERIALS_COST");
  });

  it("labels its estimates BRUTE_FORCE", () => {
    expect(streetConditionMaterialsCostEstimator.costModel).toBe("BRUTE_FORCE");
  });

  it("falls back to the generic repair profile for a null descriptor", async () => {
    await expect(streetConditionMaterialsCostEstimator.estimateCost(ORDER, makeRequest(null))).resolves.toBe(200);
  });
});
