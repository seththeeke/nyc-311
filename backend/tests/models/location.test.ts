import { describe, expect, it } from "vitest";
import { LocationSchema } from "../../models/location";

function makeLocation(overrides: Record<string, unknown> = {}): unknown {
  return {
    location_id: "1234567890",
    bbl: "1234567890",
    address: "123 Main St",
    borough: "QUEENS",
    community_board: "07 QUEENS",
    zip: "11355",
    latitude: "40.75",
    longitude: "-73.82",
    created_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("LocationSchema", () => {
  it("accepts a fully-populated Location", () => {
    expect(LocationSchema.safeParse(makeLocation()).success).toBe(true);
  });

  it("accepts null for every descriptive field", () => {
    const location = makeLocation({
      address: null,
      borough: null,
      community_board: null,
      zip: null,
      latitude: null,
      longitude: null,
    });
    expect(LocationSchema.safeParse(location).success).toBe(true);
  });

  it("rejects a missing location_id", () => {
    const location = makeLocation() as Record<string, unknown>;
    delete location["location_id"];
    expect(LocationSchema.safeParse(location).success).toBe(false);
  });

  it("rejects a missing bbl", () => {
    const location = makeLocation() as Record<string, unknown>;
    delete location["bbl"];
    expect(LocationSchema.safeParse(location).success).toBe(false);
  });

  it("rejects a missing created_at", () => {
    const location = makeLocation() as Record<string, unknown>;
    delete location["created_at"];
    expect(LocationSchema.safeParse(location).success).toBe(false);
  });

  it("rejects an empty-string bbl", () => {
    expect(LocationSchema.safeParse(makeLocation({ bbl: "" })).success).toBe(false);
  });
});
