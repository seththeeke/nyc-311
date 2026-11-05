/* The marketing page's copy (MARKETING_PAGE), kept apart from layout so the words can change without touching the animation. */

export const HEADLINE_LINES: readonly (readonly string[])[] = [
  ["New", "York", "reports", "it."],
  ["BoroughSim", "fixes", "it."],
];

export const SUBHEAD =
  "BoroughSim is a simulation: a city-services company running on live NYC 311 data. Every real street complaint becomes a job, priced, scheduled and driven to the curb by a simulated fleet, and the whole company is run by a team of AI agents.";

export const AGENT_SECTION = {
  eyebrow: "Run by agents",
  title: "One human. A whole executive team of AI.",
  body: "Operations, product, finance and technology, all auditing, deciding how to meet KPIs and debating how to run the company every day.",
};

export const FINAL_CTA = {
  title: "The city is moving right now.",
  body: "Calls are coming in, the clock is running and Patch is already on the road. Step inside.",
};

export const RESIDENTS_SECTION = {
  eyebrow: "The residents",
  title: "New Yorkers who always need something.",
  body: "BoroughSim's customers are simulated residents, each an AI with a life, a neighborhood and a temper. They follow real repairs near them, chase crews that are late and push for features. Their needs decide what BoroughSim builds next.",
};

/* The residents the section features, in order; the rest are on the Residents page. */
export const FEATURED_RESIDENT_IDS: readonly string[] = ["hawthorn", "juniper", "sycamore", "ginkgo", "yellowwood"];

/* The business flywheel, clockwise from 12 o'clock. */
export const FLYWHEEL_STEPS: readonly { title: string; body: string }[] = [
  { title: "Promise", body: "BoroughSim promises to resolve a resident's job." },
  { title: "Ideas", body: "Residents come up with ideas about the service or their job." },
  { title: "Tools", body: "BoroughSim gives residents tools to act on their ideas." },
  { title: "Insight", body: "Those tool requests show BoroughSim what customers need." },
  { title: "Build", body: "BoroughSim builds new features and tools to improve service." },
];
