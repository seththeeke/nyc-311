/*
 * "How it works" (MARKETING_PAGE): the five steps one 311 call takes. `REAL_CITY`
 * steps happen in the real New York; `BOROUGHSIM` steps are what BoroughSim does.
 */

export type JourneyActor = "REAL_CITY" | "BOROUGHSIM";
export type JourneySceneId = "REAL_DATA" | "SERVICEABILITY" | "ESTIMATE" | "SCHEDULE" | "RESOLVE";

export interface JourneyStep {
  id: JourneySceneId;
  actor: JourneyActor;
  kicker: string;
  title: string;
  body: string;
}

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    id: "REAL_DATA",
    actor: "REAL_CITY",
    kicker: "Real data",
    title: "A New Yorker calls 311",
    body: "Every job starts as a real complaint on NYC Open Data's 311 feed, the same data the city publishes. BoroughSim polls it around the clock.",
  },
  {
    id: "SERVICEABILITY",
    actor: "BOROUGHSIM",
    kicker: "Serviceability check",
    title: "Can we fix it?",
    body: "BoroughSim services street repairs: potholes, cave-ins, plates, rough roads. Everything else is turned away with a reason.",
  },
  {
    id: "ESTIMATE",
    actor: "BOROUGHSIM",
    kicker: "Cost estimate",
    title: "Priced before it rolls",
    body: "Each order is costed from the complaint's metadata, the kind of defect, the borough and the season, against real-world repair cost data.",
  },
  {
    id: "SCHEDULE",
    actor: "BOROUGHSIM",
    kicker: "Scheduling",
    title: "Into the fleet",
    body: "The order is scheduled into the fleet of drivers and lands with the operator who can reach it soonest.",
  },
  {
    id: "RESOLVE",
    actor: "BOROUGHSIM",
    kicker: "Resolution",
    title: "Fixed and closed",
    body: "The operator drives out, makes the repair and resolves the order. The clock on time to resolve stops, and residents following it hear back.",
  },
];

/* The shape of a NYC Open Data 311 record, with its real field names, typed out in step 1. */
export const SAMPLE_311_RECORD: readonly (readonly [string, string])[] = [
  ["unique_key", '"63188417"'],
  ["created_date", '"2026-11-03T07:42:10"'],
  ["agency", '"DOT"'],
  ["complaint_type", '"Street Condition"'],
  ["descriptor", '"Pothole"'],
  ["incident_address", '"412 ATLANTIC AVENUE"'],
  ["borough", '"BROOKLYN"'],
  ["latitude", "40.6862"],
  ["longitude", "-73.9832"],
];

export interface IncomingComplaint {
  label: string;
  serviceable: boolean;
}

/* Step 2's stream through the gate: street repairs pass, the rest are turned away. */
export const INCOMING_COMPLAINTS: readonly IncomingComplaint[] = [
  { label: "Pothole", serviceable: true },
  { label: "Noise: Loud Music", serviceable: false },
  { label: "Cave-in", serviceable: true },
  { label: "Illegal Parking", serviceable: false },
  { label: "Plate Condition", serviceable: true },
  { label: "Missed Collection", serviceable: false },
];

/* Step 3's illustrative breakdown: the inputs the estimate reads and the parts of the price. */
export const ESTIMATE_INPUTS: readonly string[] = ["Pothole", "Brooklyn", "Autumn", "~14 sq ft"];
export const ESTIMATE_PARTS: readonly { label: string; amount: number }[] = [
  { label: "Materials", amount: 640 },
  { label: "Labor", amount: 910 },
  { label: "Borough & season", amount: 290 },
];

/* Step 4's fleet board: each lane's existing jobs as [start, length] in tenths of the shift. */
export const SCHEDULE_LANES: readonly { operator: string; jobs: readonly (readonly [number, number])[] }[] = [
  { operator: "Operator 07", jobs: [[0, 3], [4, 2]] },
  { operator: "Operator 12", jobs: [[1, 2], [6, 3]] },
  { operator: "Operator 03", jobs: [[0, 2], [3, 3]] },
  { operator: "Operator 19", jobs: [[2, 4]] },
];
/* The lane and slot the new order drops into. */
export const SCHEDULE_DROP = { lane: 2, start: 6.5, length: 2.5 };
