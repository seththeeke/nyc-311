import { describe, expect, it } from "vitest";
import { ResidentPersonaPageSchema, ResidentPersonaSchema } from "../../src/models/residentPersona";
import { MOCK_RESIDENT_PERSONAS } from "../../src/test-data/residentPersonas";

const [hawthorn] = MOCK_RESIDENT_PERSONAS;

describe("ResidentPersonaSchema", () => {
  it("accepts every sample persona", () => {
    for (const persona of MOCK_RESIDENT_PERSONAS) expect(ResidentPersonaSchema.parse(persona)).toEqual(persona);
  });

  it("rejects a dial outside 0-100 and an hour past 23", () => {
    expect(ResidentPersonaSchema.safeParse({ ...hawthorn, activity_level: 101 }).success).toBe(false);
    expect(ResidentPersonaSchema.safeParse({ ...hawthorn, active_hours: { start: 5, end: 24 } }).success).toBe(false);
  });

  it("has no status field — residents are not shown as active or paused", () => {
    expect(ResidentPersonaSchema.parse({ ...hawthorn, status: "PAUSED" })).not.toHaveProperty("status");
  });

  it("allows a persona that has never had an idea", () => {
    expect(ResidentPersonaSchema.safeParse({ ...hawthorn, idea_count: 0, last_idea_at: null }).success).toBe(true);
  });
});

describe("ResidentPersonaPageSchema", () => {
  it("reads a page with or without a next cursor", () => {
    expect(ResidentPersonaPageSchema.safeParse({ items: [hawthorn], nextCursor: null }).success).toBe(true);
    expect(ResidentPersonaPageSchema.safeParse({ items: [], nextCursor: "abc" }).success).toBe(true);
    expect(ResidentPersonaPageSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
