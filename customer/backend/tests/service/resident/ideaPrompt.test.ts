import { describe, expect, it } from "vitest";
import { buildIdeaPrompt } from "../../../service/resident/ideaPrompt";
import { seed } from "../../residentFixtures";

describe("buildIdeaPrompt", () => {
  it("starts with the resident's own prompt and carries their temperament, interests and leanings", () => {
    const prompt = buildIdeaPrompt(seed);
    expect(prompt.startsWith(seed.persona_prompt)).toBe(true);
    expect(prompt).toContain("hostility 70");
    expect(prompt).toContain("BROOKLYN");
    expect(prompt).toContain("Cave-in");
    expect(prompt).toContain("ESCALATION: push a problem higher because it is dragging on or was handled badly (you do this often)");
    expect(prompt).toContain("FEATURE_REQUEST: ask for something the service does not offer yet (you do this rarely)");
    expect(prompt).toContain("nothing_to_say");
    expect(prompt.length).toBeLessThan(8000);
  });

  it("scales length guidance with verbosity and handles no interests or a never-weight", () => {
    const talky = buildIdeaPrompt({ ...seed, demeanor: { ...seed.demeanor, verbosity: 80 } });
    expect(talky).toContain("three to five sentences");
    const terse = buildIdeaPrompt({
      ...seed,
      demeanor: { ...seed.demeanor, verbosity: 10 },
      interests: { boroughs: [], descriptors: [] },
      idea_type_weights: { ...seed.idea_type_weights, ESCALATION: 0, STATUS_CHECK: 20 },
    });
    expect(terse).toContain("one or two short sentences");
    expect(terse).toContain("the whole city.");
    expect(terse).toContain("(you do this never)");
    expect(terse).toContain("(you do this sometimes)");
  });
});
