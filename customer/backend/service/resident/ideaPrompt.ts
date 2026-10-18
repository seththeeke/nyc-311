import type { IdeaType, ResidentSeed } from "../../models/resident";

/*
 * The idea generator's system prompt, assembled from a resident's seed at
 * sync time and stored on the resident (§3 Flow B decision 3), so the
 * version row holds exactly what the model is sent. Changing this text
 * changes every resident's content hash, and so their version.
 */
export const IDEA_PROMPT_VERSION = "idea-generator@1";

const IDEA_TYPE_MEANINGS: Record<IdeaType, string> = {
  STATUS_CHECK: "find out where a repair stands",
  SERVICED_CHECK: "confirm a repair was really done, and done properly",
  ETA_REQUEST: "get a date or time for when a repair will happen",
  PRIORITY_INQUIRY: "argue a problem should be handled sooner than others",
  ESCALATION: "push a problem higher because it is dragging on or was handled badly",
  FEATURE_REQUEST: "ask for something the service does not offer yet",
};

function lean(weight: number): string {
  if (weight >= 30) return "often";
  if (weight >= 15) return "sometimes";
  if (weight > 0) return "rarely";
  return "never";
}

function verbosityGuide(verbosity: number): string {
  if (verbosity >= 60) return "You tend to say a lot: three to five sentences.";
  if (verbosity >= 30) return "You keep it to two or three sentences.";
  return "You keep it to one or two short sentences.";
}

export function buildIdeaPrompt(seed: ResidentSeed): string {
  const { demeanor, interests, idea_type_weights: weights } = seed;
  const kinds = (Object.keys(IDEA_TYPE_MEANINGS) as IdeaType[])
    .map((type) => `- ${type}: ${IDEA_TYPE_MEANINGS[type]} (you do this ${lean(weights[type])})`)
    .join("\n");
  return [
    seed.persona_prompt,
    `About you: ${seed.backstory}`,
    `Your temperament, out of 100: patience ${demeanor.patience}, hostility ${demeanor.hostility}, verbosity ${demeanor.verbosity}.`,
    `You live in New York City and pay most attention to ${interests.boroughs.join(", ") || "the whole city"}` +
      (interests.descriptors.length > 0 ? `, and to these kinds of street problems: ${interests.descriptors.join("; ")}.` : "."),
    "BoroughSim is the city's street-repair service. It takes in reports of street problems, decides which to accept, schedules crews and fixes them. Its public website shows a map and dashboards of reported problems and repair crews. Today it offers no way to contact anyone, ask a question, or subscribe to updates.",
    "Every so often you think about the street problems around you and whether you want something from BoroughSim. You are shown some open repair orders near you and the ones you have raised before. Decide for yourself whether you want something, what, and about which order, if any. Be yourself and be inventive; an idea about something BoroughSim should offer is just as welcome as one about a specific order.",
    `The kinds of idea you might have:\n${kinds}`,
    `Write the idea as what you want and why, in your own voice, as you would think it, not as a letter. ${verbosityGuide(demeanor.verbosity)}`,
    "If nothing is worth raising right now, say so with nothing_to_say. Use exactly one tool.",
  ].join("\n\n");
}
