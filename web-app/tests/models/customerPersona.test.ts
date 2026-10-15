import { describe, expect, it } from "vitest";
import { CustomerPersonaPageSchema, CustomerPersonaSchema } from "../../src/models/customerPersona";
import { MOCK_CUSTOMER_PERSONAS } from "../../src/test-data/customerPersonas";

const [hawthorn] = MOCK_CUSTOMER_PERSONAS;

describe("CustomerPersonaSchema", () => {
  it("accepts every sample persona", () => {
    for (const persona of MOCK_CUSTOMER_PERSONAS) expect(CustomerPersonaSchema.parse(persona)).toEqual(persona);
  });

  it("rejects a dial outside 0-100, an hour past 23 and an unknown status", () => {
    expect(CustomerPersonaSchema.safeParse({ ...hawthorn, activity_level: 101 }).success).toBe(false);
    expect(CustomerPersonaSchema.safeParse({ ...hawthorn, active_hours: { start: 5, end: 24 } }).success).toBe(false);
    expect(CustomerPersonaSchema.safeParse({ ...hawthorn, status: "RETIRED" }).success).toBe(false);
  });

  it("allows a persona that has never had an idea", () => {
    expect(CustomerPersonaSchema.safeParse({ ...hawthorn, idea_count: 0, last_idea_at: null }).success).toBe(true);
  });
});

describe("CustomerPersonaPageSchema", () => {
  it("reads a page with or without a next cursor", () => {
    expect(CustomerPersonaPageSchema.safeParse({ items: [hawthorn], nextCursor: null }).success).toBe(true);
    expect(CustomerPersonaPageSchema.safeParse({ items: [], nextCursor: "abc" }).success).toBe(true);
    expect(CustomerPersonaPageSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
