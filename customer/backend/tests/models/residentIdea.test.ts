import { describe, expect, it } from "vitest";
import {
  IdeaStepSchema,
  ResidentIdeaSchema,
  ResidentOrderThreadSchema,
  byOrderKey,
  ideaSortKey,
  notActionedResolution,
  stepSortKey,
  threadSortKey,
} from "../../models/residentIdea";
import { featureIdea, idea, searchStep } from "../residentFixtures";

describe("resident idea models", () => {
  it("parses an idea about an order and one about the service", () => {
    expect(ResidentIdeaSchema.parse(idea)).toEqual(idea);
    expect(ResidentIdeaSchema.parse(featureIdea)).toEqual(featureIdea);
    expect(ResidentIdeaSchema.safeParse({ ...idea, sk: "ORDER#01ORDER" }).success).toBe(false);
  });

  it("reads an idea stored before the action loop as not actioned, dropping its old status and actions", () => {
    const stored: Record<string, unknown> = { ...idea, status: "OPEN", actions: [] };
    delete stored.resolution;
    const parsed = ResidentIdeaSchema.parse(stored);
    expect(parsed.resolution).toEqual(notActionedResolution());
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("actions");
  });

  it("parses a step, and only under its idea's key", () => {
    expect(IdeaStepSchema.parse(searchStep)).toEqual(searchStep);
    expect(IdeaStepSchema.safeParse({ ...searchStep, sk: idea.sk }).success).toBe(false);
    const forced = { ...searchStep, kind: "FORCED_FINISH", decision: null, execution: null };
    expect(IdeaStepSchema.safeParse(forced).success).toBe(true);
  });

  it("parses a thread row and builds every key", () => {
    const thread = { persona_id: "hawthorn", sk: threadSortKey("01ORDER"), order_id: "01ORDER", idea_count: 2, first_idea_at: "a", last_idea_at: "b" };
    expect(ResidentOrderThreadSchema.parse(thread)).toEqual(thread);
    expect(ideaSortKey("01X")).toBe("IDEA#01X");
    expect(stepSortKey("01X", 7)).toBe("IDEA#01X#STEP#0007");
    expect(byOrderKey("hawthorn", "01ORDER")).toBe("hawthorn#01ORDER");
  });
});
