import { ACTION_BUCKET_TOOLS, type ActionType, type ResidentSeed } from "../../models/resident";

/*
 * The action loop's system prompt (docs/16-resident-action-models.md
 * §5.2), assembled from a resident's seed at sync time and stored on the
 * resident like the idea prompt. Changing this text changes every
 * resident's content hash, and so their version.
 */
export const ACTION_PROMPT_VERSION = "idea-actioner@1";

const TOOL_MEANINGS: Record<ActionType, string> = {
  SEARCH_REQUESTS: "look up the repair your idea is about and see where it stands",
  CREATE_FEATURE_REQUEST: "ask BoroughSim for something it does not do yet, in your own words",
  GET_FEATURE_REQUEST: "check on a feature request you filed before",
  BROWSE_WEBSITE: "browse BoroughSim's website",
};

function preference(weight: number): string {
  if (weight >= 60) return "you reach for this first";
  if (weight >= 30) return "you use this when it fits";
  return "you rarely bother with this";
}

function patienceGuide(patience: number): string {
  if (patience >= 60) return "You are patient: you will try more than one thing before you settle.";
  if (patience >= 30) return "You give things a fair try, but you will not chase forever.";
  return "You are impatient: if the first thing you try does not get you what you want, you are quick to give up or be annoyed.";
}

export function buildActionPrompt(seed: ResidentSeed): string {
  const granted = seed.action_buckets.flatMap((bucket) => ACTION_BUCKET_TOOLS[bucket]);
  const tools =
    granted.length > 0
      ? granted.map((tool) => `- ${tool}: ${TOOL_MEANINGS[tool]} (${preference(seed.action_weights[tool])})`).join("\n")
      : "- none yet";
  return [
    seed.persona_prompt,
    `About you: ${seed.backstory}`,
    `Your temperament, out of 100: patience ${seed.demeanor.patience}, hostility ${seed.demeanor.hostility}, verbosity ${seed.demeanor.verbosity}.`,
    "You recently had an idea: something you want from BoroughSim, the city's street-repair service. Now you decide what, if anything, to do about it, using the tools you have. Each tool does exactly what it says through BoroughSim's public API and tells you what came back; never assume a result you have not seen.",
    `Your tools, and how you feel about each:\n${tools}`,
    patienceGuide(seed.demeanor.patience),
    "Use one tool at a time. When you are done, because you got what you wanted, because you did not and are not going to, or because it is not worth the effort, call finish_idea with how it went and a few words in your own voice about it. If you plan to come back to it later, say what you would check in follow_up. You may finish straight away if doing nothing is what you would really do.",
  ].join("\n\n");
}
