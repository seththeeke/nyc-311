import { describe, expect, it } from "vitest";
import { CreateFeatureRequestBodySchema, FeatureRequestIdParamsSchema } from "../../../models/publicApi/featureRequest";
import { SearchRequestsBodySchema } from "../../../models/publicApi/searchRequests";

describe("SearchRequestsBodySchema", () => {
  it("defaults limit to 20", () => {
    expect(SearchRequestsBodySchema.parse({ search_params: { order_id: "01K7XWQ2B9N4M8F3T6RZ0Y5DKA" } }).limit).toBe(20);
  });

  it("rejects an unsupported filter, a malformed id and a limit over 50", () => {
    const ok = { search_params: { order_id: "01K7XWQ2B9N4M8F3T6RZ0Y5DKA" } };
    expect(SearchRequestsBodySchema.safeParse({ search_params: { ...ok.search_params, borough: "BRONX" } }).success).toBe(false);
    expect(SearchRequestsBodySchema.safeParse({ search_params: { order_id: "nope" } }).success).toBe(false);
    expect(SearchRequestsBodySchema.safeParse({ ...ok, limit: 51 }).success).toBe(false);
  });
});

describe("CreateFeatureRequestBodySchema", () => {
  const body = { title: "Texts please", description: "Text me when work is booked.", submitted_by: { name: "Hawthorn" } };

  it("accepts a body without an email", () => {
    expect(CreateFeatureRequestBodySchema.safeParse(body).success).toBe(true);
  });

  it("enforces the field limits", () => {
    expect(CreateFeatureRequestBodySchema.safeParse({ ...body, title: "Hi" }).success).toBe(false);
    expect(CreateFeatureRequestBodySchema.safeParse({ ...body, description: "x".repeat(2001) }).success).toBe(false);
    expect(CreateFeatureRequestBodySchema.safeParse({ ...body, submitted_by: { name: "x".repeat(81) } }).success).toBe(false);
    expect(CreateFeatureRequestBodySchema.safeParse({ ...body, submitted_by: { name: "H", email: "not-an-email" } }).success).toBe(false);
  });
});

describe("FeatureRequestIdParamsSchema", () => {
  it("accepts only a ULID", () => {
    expect(FeatureRequestIdParamsSchema.safeParse({ feature_request_id: "01K8C4T1W7H3P9N2M6QZ8V0RJD" }).success).toBe(true);
    expect(FeatureRequestIdParamsSchema.safeParse({ feature_request_id: "CRID#x" }).success).toBe(false);
  });
});
