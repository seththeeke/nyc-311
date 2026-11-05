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
  body: "Operations, product, finance and technology each belong to an agent with one job and one metric. They meet, argue in Team Chat and run the company every day.",
};

export const FINAL_CTA = {
  title: "The city is moving right now.",
  body: "Trucks are on the road, calls are coming in, and the clock is running. Step inside.",
};

export const RESIDENTS_SECTION = {
  eyebrow: "The residents",
  title: "New Yorkers who always need something.",
  body: "BoroughSim's customers are simulated residents, each an AI with a life, a neighborhood and a temper. They follow real repairs near them, chase crews that are late and push for features. Their needs decide what BoroughSim builds next.",
};

/* The resident flywheel, clockwise from 12 o'clock. */
export const FLYWHEEL_STEPS: readonly { title: string; body: string }[] = [
  { title: "A need", body: "A pothole on the delivery route, a job that's gone quiet, an idea for a text when the crew is close." },
  { title: "They reach out", body: "Residents use BoroughSim's public API to look up their request or file a feature request." },
  { title: "A Contact is logged", body: "Every ask is tracked from first touch to answer." },
  { title: "The CPO files the work", body: "Celestine turns the strongest needs into tickets aimed at satisfaction and cost per order." },
  { title: "The agents ship it", body: "Better service, happier residents, and new needs to meet. The wheel turns again." },
];
