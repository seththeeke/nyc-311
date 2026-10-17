import { describe, expect, it } from "vitest";
import { ResidentIdeaPageSchema, ResidentIdeaSchema, IdeaActionSchema } from "../../src/models/residentIdea";
import { MOCK_RESIDENT_IDEAS } from "../../src/test-data/residentIdeas";

const [first] = MOCK_RESIDENT_IDEAS;

describe("ResidentIdeaSchema", () => {
  it("accepts every sample idea, anchored or not", () => {
    for (const idea of MOCK_RESIDENT_IDEAS) expect(ResidentIdeaSchema.parse(idea)).toEqual(idea);
    expect(MOCK_RESIDENT_IDEAS.some((idea) => idea.anchor === null)).toBe(true);
  });

  it("rejects an unknown idea type, a status other than OPEN and negative token counts", () => {
    expect(ResidentIdeaSchema.safeParse({ ...first, idea_type: "COMPLIMENT" }).success).toBe(false);
    expect(ResidentIdeaSchema.safeParse({ ...first, status: "ACTIONED" }).success).toBe(false);
    expect(ResidentIdeaSchema.safeParse({ ...first, input_tokens: -1 }).success).toBe(false);
  });
});

describe("ResidentIdeaPageSchema", () => {
  it("reads a page of ideas", () => {
    expect(ResidentIdeaPageSchema.parse({ items: [first], nextCursor: null }).items).toHaveLength(1);
  });
});

describe("IdeaActionSchema", () => {
  const byType = (type: string) => MOCK_RESIDENT_IDEAS.find((idea) => idea.action?.type === type)!.action!;

  it("reads every kind of action in the sample data, and an unactioned idea", () => {
    for (const type of ["REQUEST_FEATURE", "CHECK_STATUS_API", "BROWSE_WEBSITE"]) {
      expect(IdeaActionSchema.parse(byType(type))).toEqual(byType(type));
    }
    expect(MOCK_RESIDENT_IDEAS.some((idea) => idea.action === null)).toBe(true);
  });

  it("rejects an unknown action type, a recording with no steps, and a non-URL video", () => {
    const browse = byType("BROWSE_WEBSITE");
    expect(IdeaActionSchema.safeParse({ ...browse, type: "PHONE_CALL" }).success).toBe(false);
    if (browse.type !== "BROWSE_WEBSITE") throw new Error("fixture");
    expect(IdeaActionSchema.safeParse({ ...browse, recording: { ...browse.recording, steps: [] } }).success).toBe(false);
    expect(IdeaActionSchema.safeParse({ ...browse, recording: { ...browse.recording, video_url: "not a url" } }).success).toBe(false);
  });

  it("requires every idea to say whether it was actioned", () => {
    const withoutAction: Partial<typeof first> = { ...first };
    delete withoutAction.action;
    expect(ResidentIdeaSchema.safeParse(withoutAction).success).toBe(false);
  });
});
