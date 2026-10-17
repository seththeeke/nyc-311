import { describe, expect, it } from "vitest";
import { ResidentIdeaActionSchema, ResidentIdeaSchema, ResidentOrderThreadSchema, byOrderKey, ideaSortKey, threadSortKey } from "../../models/residentIdea";
import { featureIdea, idea } from "../residentFixtures";

describe("resident idea models", () => {
  it("parses an idea about an order and one about the service", () => {
    expect(ResidentIdeaSchema.parse(idea)).toEqual(idea);
    expect(ResidentIdeaSchema.parse(featureIdea)).toEqual(featureIdea);
    expect(ResidentIdeaSchema.safeParse({ ...idea, sk: "ORDER#01ORDER" }).success).toBe(false);
  });

  it("keeps a tool's own evidence fields on an action", () => {
    const action = {
      sequence: 1,
      type: "REQUEST_FEATURE",
      status: "COMPLETED",
      started_at: "a",
      completed_at: "b",
      summary: "Asked for texts.",
      outcome: null,
      feature_request: { title: "Texts" },
    };
    expect(ResidentIdeaActionSchema.parse(action)).toEqual(action);
  });

  it("parses a thread row and builds every key", () => {
    const thread = { persona_id: "hawthorn", sk: threadSortKey("01ORDER"), order_id: "01ORDER", idea_count: 2, first_idea_at: "a", last_idea_at: "b" };
    expect(ResidentOrderThreadSchema.parse(thread)).toEqual(thread);
    expect(ideaSortKey("01X")).toBe("IDEA#01X");
    expect(byOrderKey("hawthorn", "01ORDER")).toBe("hawthorn#01ORDER");
  });
});
