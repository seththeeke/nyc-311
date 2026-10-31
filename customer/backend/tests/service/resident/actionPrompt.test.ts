import { describe, expect, it } from "vitest";
import { ACTION_PROMPT_VERSION, buildActionPrompt } from "../../../service/resident/actionPrompt";
import { seed } from "../../residentFixtures";

describe("buildActionPrompt", () => {
  it("speaks as the resident, lists only granted tools with their preference, and explains finish_idea", () => {
    const prompt = buildActionPrompt(seed);
    expect(prompt.startsWith(seed.persona_prompt)).toBe(true);
    expect(prompt).toContain("SEARCH_REQUESTS: look up the repair your idea is about and see where it stands (you reach for this first)");
    expect(prompt).toContain("CREATE_FEATURE_REQUEST");
    expect(prompt).toContain("(you rarely bother with this)");
    expect(prompt).not.toContain("BROWSE_WEBSITE");
    expect(prompt).toContain("finish_idea");
    expect(prompt).toContain("You are impatient");
    expect(ACTION_PROMPT_VERSION).toBe("idea-actioner@1");
  });

  it("follows patience and preference, and says so when there are no tools", () => {
    const patient = buildActionPrompt({ ...seed, demeanor: { ...seed.demeanor, patience: 80 }, action_weights: { ...seed.action_weights, SEARCH_REQUESTS: 40 } });
    expect(patient).toContain("You are patient");
    expect(patient).toContain("(you use this when it fits)");
    expect(buildActionPrompt({ ...seed, demeanor: { ...seed.demeanor, patience: 40 } })).toContain("You give things a fair try");
    expect(buildActionPrompt({ ...seed, action_buckets: [] })).toContain("- none yet");
  });
});
