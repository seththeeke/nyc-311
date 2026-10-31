import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "../../../models/contact";
import { NotFoundError, ValidationError } from "../../../models/errors";
import type { Location } from "../../../models/location";
import type { Order } from "../../../models/order";
import { FeatureRequestSchema } from "../../../models/publicApi/featureRequest";
import { SearchRequestsResponseSchema } from "../../../models/publicApi/searchRequests";

/*
 * One file for every publicApiService test: the suite runs with
 * isolate: false, so the domain-service mocks must all be declared by the
 * one file that imports the service.
 */
vi.mock("../../../service/order/orderService", () => ({
  getOrder: vi.fn(),
  getOrderRejectionReasonCode: vi.fn(),
}));
vi.mock("../../../service/location/locationService", () => ({
  getLocation: vi.fn(),
}));
vi.mock("../../../service/contact/contactService", () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
}));

import { createContact, getContact } from "../../../service/contact/contactService";
import { getLocation } from "../../../service/location/locationService";
import { getOrder, getOrderRejectionReasonCode } from "../../../service/order/orderService";
import {
  createFeatureRequest,
  getFeatureRequest,
  getOpenApiSpec,
  searchRequests,
  toFeatureRequest,
  toServiceRequestStatus,
} from "../../../service/publicApi/publicApiService";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  for (const mock of [getOrder, getLocation, getOrderRejectionReasonCode, createContact, getContact]) vi.mocked(mock).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

const contact: Contact = {
  contact_id: "01K8C4T1W7H3P9N2M6QZ8V0RJD",
  contact_type: "FEATURE_REQUEST",
  status: "RECEIVED",
  title: "Text me when a repair near me is scheduled",
  description: "Let me subscribe to a street and get a text when work is booked.",
  submitter: { name: "Hawthorn", email: "hawthorn@example.com" },
  closure_reason_code: null,
  closure_reason_description: null,
  client_request_id: "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
  created_at: "2026-11-02T22:14:02.000Z",
  updated_at: "2026-11-02T22:14:02.000Z",
};

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

describe("toFeatureRequest", () => {
  it("never shows the email, the idempotency key or the contact type", () => {
    const featureRequest = toFeatureRequest(contact);
    expect(featureRequest).toEqual({
      feature_request_id: contact.contact_id,
      status: "RECEIVED",
      status_reason_description: null,
      title: contact.title,
      description: contact.description,
      submitted_by: { name: "Hawthorn" },
      created_at: contact.created_at,
      updated_at: contact.updated_at,
    });
    expect(FeatureRequestSchema.safeParse(featureRequest).success).toBe(true);
    const text = JSON.stringify(featureRequest);
    for (const hidden of ["hawthorn@example.com", "b6f0c1e2", "FEATURE_REQUEST", "contact"]) expect(text).not.toContain(hidden);
  });

  it("maps every Contact status, with the closure reason as the status reason", () => {
    expect(toFeatureRequest({ ...contact, status: "IN_PROGRESS" }).status).toBe("UNDER_REVIEW");
    expect(toFeatureRequest({ ...contact, status: "CLOSED", closure_reason_description: "Shipped." })).toMatchObject({
      status: "CLOSED",
      status_reason_description: "Shipped.",
    });
  });
});

describe("createFeatureRequest", () => {
  it("files a FEATURE_REQUEST Contact with the idempotency key as client_request_id", async () => {
    vi.mocked(createContact).mockResolvedValue(contact);
    const result = await createFeatureRequest(
      { title: contact.title, description: contact.description, submitted_by: { name: "Hawthorn" } },
      "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11"
    );
    expect(createContact).toHaveBeenCalledWith({
      contact_type: "FEATURE_REQUEST",
      title: contact.title,
      description: contact.description,
      submitter: { name: "Hawthorn", email: null },
      client_request_id: "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
    });
    expect(result.feature_request_id).toBe(contact.contact_id);
  });

  it("passes an email through and no key as null", async () => {
    vi.mocked(createContact).mockResolvedValue(contact);
    await createFeatureRequest({ title: "t", description: "d", submitted_by: { name: "H", email: "h@example.com" } }, null);
    expect(vi.mocked(createContact).mock.calls[0][0]).toMatchObject({ submitter: { name: "H", email: "h@example.com" }, client_request_id: null });
  });
});

describe("getFeatureRequest", () => {
  it("returns the feature request", async () => {
    vi.mocked(getContact).mockResolvedValue(contact);
    await expect(getFeatureRequest(contact.contact_id)).resolves.toMatchObject({ feature_request_id: contact.contact_id });
  });

  it("treats a Contact of another type as missing", async () => {
    vi.mocked(getContact).mockResolvedValue({ ...contact, contact_type: "OTHER" } as unknown as Contact);
    await expect(getFeatureRequest(contact.contact_id)).rejects.toThrow(NotFoundError);
  });
});

describe("getOpenApiSpec", () => {
  it("reads the spec as text", async () => {
    const spec = await getOpenApiSpec({ specPath: join(__dirname, "../../../controller/web-api/publicV1/openapi.yaml") });
    expect(spec.startsWith("openapi: 3.1.0")).toBe(true);
  });

  it("reads the copy beside the handler by default, as the Lambda bundle has", async () => {
    await expect(getOpenApiSpec()).rejects.toThrow(/openapi\.yaml/);
  });
});
