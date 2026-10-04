import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streetConditionProcessingTimeEstimator } from "../../../service/scheduling/streetConditionProcessingTimeService";
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
  ["Pothole", 30],
  ["Cave-in", 120],
  ["Defective Hardware", 60],
  ["Rough, Pitted or Cracked Roads", 90],
  ["Failed Street Repair", 60],
  ["Plate Condition - Noisy", 30],
  ["Plate Condition - Shifted", 30],
  ["Plate Condition - Open", 30],
  ["Plate Condition - Anti-Skid", 30],
  ["Line/Marking - Faded", 45],
  ["Line/Marking - After Repaving", 45],
  ["Crash Cushion Defect", 90],
  ["Guard Rail - Street", 90],
  ["Blocked - Construction", 15],
  ["Dumpster - Construction Waste", 15],
  ["Unsafe Worksite", 15],
  ["Depression Maintenance", 60],
  ["Wear & Tear", 60],
  ["Hummock", 60],
  ["General Bad Condition", 60],
];

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streetConditionProcessingTimeEstimator", () => {
  it.each(EXPECTED)("returns the constant expectation for %s (%d minutes)", async (descriptor, expected) => {
    await expect(streetConditionProcessingTimeEstimator.estimateMinutes(ORDER, makeRequest(descriptor))).resolves.toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the generic repair profile and logs UnknownDescriptor for a new descriptor", async () => {
    await expect(streetConditionProcessingTimeEstimator.estimateMinutes(ORDER, makeRequest("Brand New Descriptor"))).resolves.toBe(60);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("UnknownDescriptor");
    expect(String(warn.mock.calls[0]?.[0])).toContain("PROCESSING_MINUTES");
  });

  it("falls back to the generic repair profile for a null descriptor", async () => {
    await expect(streetConditionProcessingTimeEstimator.estimateMinutes(ORDER, makeRequest(null))).resolves.toBe(60);
  });
});
