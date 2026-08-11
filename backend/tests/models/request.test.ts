import { describe, expect, it } from "vitest";
import { RequestSchema } from "../../models/request";

const validRequest = {
  request_id: "01J0000000000000000000000",
  source: "NYC_311",
  external_unique_key: "69243509",
  location_id: null,
  complaint_type: "Noise - Residential",
  descriptor: "Banging/Pounding",
  agency: "NYPD",
  raw_payload: { unique_key: "69243509" },
  status: "DRAFT",
  created_by: null,
  created_at: "2026-06-05T01:50:27.000",
};

describe("RequestSchema", () => {
  it("accepts a fully-populated draft Request", () => {
    expect(RequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("accepts nulls for complaint_type/descriptor/agency/location_id (lenient ingest)", () => {
    const sparse = {
      ...validRequest,
      complaint_type: null,
      descriptor: null,
      agency: null,
      location_id: null,
    };
    expect(RequestSchema.safeParse(sparse).success).toBe(true);
  });

  it("rejects a missing external_unique_key", () => {
    const withoutKey: Record<string, unknown> = { ...validRequest };
    delete withoutKey.external_unique_key;
    expect(RequestSchema.safeParse(withoutKey).success).toBe(false);
  });

  it("rejects a source other than NYC_311", () => {
    expect(RequestSchema.safeParse({ ...validRequest, source: "public_demo" }).success).toBe(false);
  });

  it("rejects a status outside the known enum", () => {
    expect(RequestSchema.safeParse({ ...validRequest, status: "archived" }).success).toBe(false);
  });

  it("rejects a non-null created_by", () => {
    expect(RequestSchema.safeParse({ ...validRequest, created_by: "user_admin_01" }).success).toBe(false);
  });
});
