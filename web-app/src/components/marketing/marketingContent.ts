/* The marketing page's copy (MARKETING_PAGE), kept apart from layout so the words can change without touching the animation. */

export interface PipelineStage {
  id: string;
  label: string;
  title: string;
  body: string;
}

export const HEADLINE_LINES: readonly (readonly string[])[] = [
  ["New", "York", "reports", "it."],
  ["BoroughSim", "fixes", "it."],
];

export const SUBHEAD =
  "BoroughSim is a simulation: a city-services company running on live NYC 311 data. Every real street complaint becomes a job, priced, scheduled and driven to the curb by a simulated fleet, and the whole company is run by a team of AI agents.";

/* Real NYC 311 Street Condition descriptors, plus the calls the city files around them, for the ticker. */
export const COMPLAINT_TICKER: readonly string[] = [
  "Pothole",
  "Cave-in",
  "Plate Condition",
  "Blocked: Construction",
  "Rough Roads",
  "Defective Hardware",
  "Failed Street Repair",
  "Line or Marking Faded",
  "Wear and Tear",
  "Crack in Pavement",
];

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  { id: "CALL", label: "01", title: "A New Yorker calls 311", body: "The complaint lands on NYC Open Data. BoroughSim polls it around the clock." },
  { id: "ACCEPT", label: "02", title: "Accepted as an order", body: "Street conditions we can fix become orders. Everything else is turned away with a reason." },
  { id: "PRICE", label: "03", title: "Priced and scheduled", body: "Each job is costed, then matched to the operator who can reach it soonest." },
  { id: "DRIVE", label: "04", title: "A truck rolls out", body: "The operator drives the real streets of the five boroughs to the job." },
  { id: "RESOLVE", label: "05", title: "Fixed, and they hear back", body: "The job closes and the resident gets a webhook. The clock on time-to-resolve stops." },
];

export const AGENT_SECTION = {
  eyebrow: "Run by agents",
  title: "One human. A whole executive team of AI.",
  body: "Operations, product, finance and technology each belong to an agent with one job and one metric. They meet, argue in Team Chat and run the company every day.",
};

export const FINAL_CTA = {
  title: "The city is moving right now.",
  body: "Trucks are on the road, calls are coming in, and the clock is running. Step inside.",
};
