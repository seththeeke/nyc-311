import { describe, expect, it } from "vitest";
import { IdeaStepSchema, ResidentIdeaDetailSchema, ResidentIdeaPageSchema, ResidentIdeaSchema, notActionedResolution } from "../../src/models/residentIdea";
import { MOCK_IDEA_STEPS, MOCK_RESIDENT_IDEAS } from "../../src/test-data/residentIdeas";

const [first] = MOCK_RESIDENT_IDEAS;

describe("ResidentIdeaSchema", () => {
  it("accepts every sample idea, anchored or not, with one of every resolution", () => {
    for (const idea of MOCK_RESIDENT_IDEAS) expect(ResidentIdeaSchema.parse(idea)).toEqual(idea);
    expect(MOCK_RESIDENT_IDEAS.some((idea) => idea.anchor === null)).toBe(true);
    const statuses = new Set(MOCK_RESIDENT_IDEAS.map((idea) => idea.resolution.status));
    expect([...statuses].sort()).toEqual(["GAVE_UP", "IN_PROGRESS", "MAX_DEPTH_REACHED", "NOT_ACTIONED", "SATISFIED", "UNSATISFIED"]);
  });

  it("reads an idea from the API before the action loop (status and actions, no resolution) as not actioned", () => {
    const legacy: Record<string, unknown> = { ...first, status: "OPEN", actions: [] };
    delete legacy.resolution;
    delete legacy.feature_request_id;
    const parsed = ResidentIdeaSchema.parse(legacy);
    expect(parsed.resolution).toEqual(notActionedResolution());
    expect(parsed.feature_request_id).toBeNull();
    expect(parsed).not.toHaveProperty("actions");
  });

  it("rejects an unknown idea type, an unknown resolution and negative token counts", () => {
    expect(ResidentIdeaSchema.safeParse({ ...first, idea_type: "COMPLIMENT" }).success).toBe(false);
    expect(ResidentIdeaSchema.safeParse({ ...first, resolution: { ...first.resolution, status: "THRILLED" } }).success).toBe(false);
    expect(ResidentIdeaSchema.safeParse({ ...first, input_tokens: -1 }).success).toBe(false);
  });
});

describe("ResidentIdeaDetailSchema", () => {
  it("reads an idea with its steps, and one without any as an empty workstream", () => {
    const steps = MOCK_IDEA_STEPS["01K7IDEA0009"];
    expect(ResidentIdeaDetailSchema.parse({ ...first, steps }).steps).toEqual(steps);
    expect(ResidentIdeaDetailSchema.parse(first).steps).toEqual([]);
  });

  it("accepts every sample step, and a forced finish with no decision", () => {
    for (const step of Object.values(MOCK_IDEA_STEPS).flat()) expect(IdeaStepSchema.parse(step)).toEqual(step);
    expect(IdeaStepSchema.safeParse({ ...MOCK_IDEA_STEPS["01K7IDEA0007"][0], kind: "WANDERED_OFF" }).success).toBe(false);
  });
});

describe("ResidentIdeaPageSchema", () => {
  it("reads a page of ideas", () => {
    expect(ResidentIdeaPageSchema.parse({ items: [first], nextCursor: null }).items).toHaveLength(1);
  });
});
