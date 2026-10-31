import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Location } from "../../../models/location";
import type { Order } from "../../../models/order";
import { SearchRequestsResponseSchema } from "../../../models/publicApi/searchRequests";

vi.mock("../../../service/order/orderService", () => ({
  getOrder: vi.fn(),
  getOrderRejectionReasonCode: vi.fn(),
}));
vi.mock("../../../service/location/locationService", () => ({
  getLocation: vi.fn(),
}));

import { getLocation } from "../../../service/location/locationService";
import { getOrder, getOrderRejectionReasonCode } from "../../../service/order/orderService";
import { searchRequests, toServiceRequestStatus } from "../../../service/publicApi/publicApiService";
import { ValidationError } from "../../../models/errors";

const ORDER_ID = "01K7XWQ2B9N4M8F3T6RZ0Y5DKA";

const order: Order = {
  order_id: ORDER_ID,
  request_id: "01K7XW9F0C2A7K5D8S3TQ1M4EB",
  location_id: "3011870001",
  complaint_type: "Street Condition",
  current_stage: "SCHEDULE",
  status: "ACTIVE",
  retry_counts: {},
  priority_tier: "P1",
  sla_deadline: "2026-11-05T00:00:00.000Z",
  scheduled_start: "2026-11-03T13:00:00.000Z",
  scheduled_end: "2026-11-03T15:00:00.000Z",
  assigned_operator_id: "op-7",
  reassignment_count: 0,
  case_id: null,
  estimated_materials_cost: 120,
  created_at: "2026-10-14T14:03:11.000Z",
  updated_at: "2026-11-02T09:10:00.000Z",
  last_event_sequence: 3,
};

const location: Location = {
  location_id: "3011870001",
  bbl: "3011870001",
  address: "412 ATLANTIC AVENUE",
  borough: "BROOKLYN",
  community_board: "02 BROOKLYN",
  zip: "11217",
  latitude: "40.6862",
  longitude: "-73.9839",
  created_at: "2026-10-13T22:41:00.000Z",
};

const body = { search_params: { order_id: ORDER_ID }, limit: 20 };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(getOrder).mockReset();
  vi.mocked(getLocation).mockReset();
  vi.mocked(getOrderRejectionReasonCode).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchRequests", () => {
  it("returns the Order and its Location as one public item, with nothing internal", async () => {
    vi.mocked(getOrder).mockResolvedValue(order);
    vi.mocked(getLocation).mockResolvedValue(location);
    const response = await searchRequests(body);

    expect(response).toEqual({
      items: [
        {
          order_id: ORDER_ID,
          request_id: order.request_id,
          complaint_type: "Street Condition",
          borough: "BROOKLYN",
          address: "412 ATLANTIC AVENUE",
          zip: "11217",
          status: "SCHEDULED",
          status_reason_description: null,
          scheduled_window: { start: "2026-11-03T13:00:00.000Z", end: "2026-11-03T15:00:00.000Z" },
          received_at: order.created_at,
          status_updated_at: order.updated_at,
        },
      ],
      next_cursor: null,
    });
    expect(SearchRequestsResponseSchema.safeParse(response).success).toBe(true);
    const text = JSON.stringify(response);
    for (const secret of ["P1", "op-7", "sla", "120", "3011870001", "40.6862", "02 BROOKLYN"]) expect(text).not.toContain(secret);
    expect(getOrderRejectionReasonCode).not.toHaveBeenCalled();
  });

  it("returns an empty page for an unknown order", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);
    await expect(searchRequests(body)).resolves.toEqual({ items: [], next_cursor: null });
  });

  it("explains a rejection in public words and leaves location fields null without a Location", async () => {
    vi.mocked(getOrder).mockResolvedValue({ ...order, status: "REJECTED", location_id: null, scheduled_start: null, scheduled_end: null });
    vi.mocked(getOrderRejectionReasonCode).mockResolvedValue("LOCATION_UNRESOLVED");
    const [item] = (await searchRequests(body)).items;
    expect(item).toMatchObject({
      status: "NOT_SERVICED",
      status_reason_description: "The location of this request couldn't be resolved.",
      borough: null,
      address: null,
      zip: null,
      scheduled_window: null,
    });
    expect(getLocation).not.toHaveBeenCalled();
  });

  it("leaves the reason null when a rejection has no known code", async () => {
    vi.mocked(getOrder).mockResolvedValue({ ...order, status: "REJECTED" });
    vi.mocked(getLocation).mockResolvedValue(null);
    vi.mocked(getOrderRejectionReasonCode).mockResolvedValue(null);
    expect((await searchRequests(body)).items[0].status_reason_description).toBeNull();
  });

  it("rejects any cursor, since v1 search has one page", async () => {
    await expect(searchRequests({ ...body, cursor: "abc" })).rejects.toThrow(ValidationError);
    expect(getOrder).not.toHaveBeenCalled();
  });
});

describe("toServiceRequestStatus", () => {
  it.each([
    [{ status: "REJECTED" }, "NOT_SERVICED"],
    [{ status: "CREATED", current_stage: "INGEST" }, "RECEIVED"],
    [{ status: "ACTIVE", current_stage: "SCHEDULE", scheduled_start: null }, "ACCEPTED"],
    [{ status: "ACTIVE", current_stage: "SCHEDULE", scheduled_start: "2026-11-03T13:00:00.000Z" }, "SCHEDULED"],
    [{ status: "ACTIVE", current_stage: "EXECUTE" }, "IN_PROGRESS"],
    [{ status: "ACTIVE", current_stage: "RESOLVE" }, "RESOLVED"],
    [{ status: "ACTIVE", current_stage: "INGEST" }, "RECEIVED"],
  ] as const)("maps %j to %s", (fields, expected) => {
    expect(toServiceRequestStatus({ ...order, ...fields } as Order)).toBe(expected);
  });
});
