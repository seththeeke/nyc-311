// Reusable sample-data generator for demo-frontend.
// Produces static JSON fixtures for every entity in docs/data-model.md,
// referentially consistent (Request -> Order -> Case, Operator <-> Shift).
// Re-run with `node generate-sample-data.mjs` to reshuffle the demo dataset.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scale knobs — bump these to stress-test the UI/map at higher volume.
const TOTAL_ORDERS = 1000;
const TOTAL_OPERATORS = 50;
const OFF_SHIFT_OPERATORS = 6; // the rest (TOTAL_OPERATORS - this) are on-duty, spread across active shifts

let seed = 42;
function rand() {
  // small deterministic PRNG so the dataset is stable across regenerations
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function id(prefix, n) {
  return `${prefix}_${String(n).padStart(4, "0")}`;
}
function isoMinutesAgo(mins) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}
function isoMinutesFromNow(mins) {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
const BOROUGH_ANCHORS = {
  MANHATTAN: { lat: [40.7, 40.87], lng: [-74.01, -73.93] },
  BROOKLYN: { lat: [40.57, 40.73], lng: [-74.03, -73.86] },
  QUEENS: { lat: [40.55, 40.8], lng: [-73.96, -73.7] },
  BRONX: { lat: [40.79, 40.91], lng: [-73.93, -73.79] },
  "STATEN ISLAND": { lat: [40.5, 40.64], lng: [-74.25, -74.05] },
};
const STREETS = [
  "Broadway", "5th Ave", "Atlantic Ave", "Northern Blvd", "Grand Concourse",
  "Flatbush Ave", "Queens Blvd", "Court St", "Union St", "Bedford Ave",
  "Metropolitan Ave", "Fordham Rd", "Hylan Blvd", "Richmond Ave", "Church Ave",
];
const COMMUNITY_BOARDS = { MANHATTAN: "MN07", BROOKLYN: "BK06", QUEENS: "QN03", BRONX: "BX05", "STATEN ISLAND": "SI02" };
const ZIPS = { MANHATTAN: "10025", BROOKLYN: "11215", QUEENS: "11375", BRONX: "10458", "STATEN ISLAND": "10301" };

function makeLocation(n, borough) {
  const a = BOROUGH_ANCHORS[borough];
  const lat = a.lat[0] + rand() * (a.lat[1] - a.lat[0]);
  const lng = a.lng[0] + rand() * (a.lng[1] - a.lng[0]);
  const bbl = `${{ MANHATTAN: 1, BRONX: 2, BROOKLYN: 3, QUEENS: 4, "STATEN ISLAND": 5 }[borough]}${randInt(1000, 9999)}${randInt(1, 99)}`;
  return {
    location_id: bbl,
    bbl,
    address: `${randInt(10, 999)} ${pick(STREETS)}`,
    borough,
    community_board: COMMUNITY_BOARDS[borough],
    zip: ZIPS[borough],
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    created_at: isoMinutesAgo(randInt(60, 60 * 24 * 5)),
  };
}

const boroughsCycle = ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"];
const locations = [];
// Enough unique addresses that 1000 Orders don't all stack on identical pins —
// still fewer than the order count, so some addresses recur (a real pattern,
// see data-model.md Appendix A: ~12% of addresses repeat within a window).
const LOCATION_COUNT = Math.min(600, Math.max(20, Math.round(TOTAL_ORDERS * 0.6)));
for (let i = 1; i <= LOCATION_COUNT; i++) {
  locations.push(makeLocation(i, boroughsCycle[i % boroughsCycle.length]));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const users = [
  {
    user_id: "user_admin_01",
    type: "admin",
    status: "active",
    created_at: isoMinutesAgo(60 * 24 * 90),
    updated_at: isoMinutesAgo(60 * 2),
    last_active_at: isoMinutesAgo(20),
    cognito_sub: "mock-cognito-sub-0001",
    email: "ops-admin@civicfield.demo",
    display_name: "Jordan Reyes",
  },
];

// ---------------------------------------------------------------------------
// Requests / Orders / OrderEvents
// ---------------------------------------------------------------------------
const COMPLAINT_CATALOG = [
  { complaint_type: "Noise - Residential", descriptor: "Loud Music/Party", agency: "NYPD" },
  { complaint_type: "Illegal Parking", descriptor: "Blocked Hydrant", agency: "NYPD" },
  { complaint_type: "Rodent", descriptor: "Condition Attracting Rodents", agency: "DSNY" },
  { complaint_type: "Sanitation Condition", descriptor: "Missed Collection", agency: "DSNY" },
  { complaint_type: "Street Light Condition", descriptor: "Light Out", agency: "DOT" },
  { complaint_type: "Blocked Driveway", descriptor: "No Access", agency: "DOT" },
  { complaint_type: "Heat/Hot Water", descriptor: "Entire Building", agency: "HPD" },
  { complaint_type: "Water System", descriptor: "Hydrant Leaking", agency: "DEP" },
];
const PRIORITY_BY_COMPLAINT = {
  "Heat/Hot Water": "critical",
  "Water System": "high",
  "Noise - Residential": "standard",
  "Illegal Parking": "standard",
  Rodent: "standard",
  "Sanitation Condition": "standard",
  "Street Light Condition": "high",
  "Blocked Driveway": "standard",
};
const STAGES = ["Ingest", "Schedule", "Execute", "Resolve"];

const requests = [];
const orders = [];
const orderEvents = [];
const operatorAssignmentPool = []; // { order_id, location_id } for in-flight orders, consumed by operators

let reqN = 0, ordN = 0, evN = 0;
function makeOrderEvent(order_id, seq, event_type, stage, payload, occurred_at, actor = "system") {
  evN++;
  orderEvents.push({ order_id, sequence_number: seq, event_type, stage: stage ?? null, payload, occurred_at, actor });
}

// Distribution across the workflow so the map/board has something in every
// stage. Most historical Orders end up Resolved (they don't render as map
// pins); the rest are "in flight" right now and do. Execute's share is sized
// close to on-duty operator capacity (see TOTAL_OPERATORS below) so most
// Execute-stage Orders actually get a truck, rather than 1000 orders all
// fighting over 50 trucks at once.
const STAGE_WEIGHTS = {
  Ingest: 0.06,
  Schedule: 0.08,
  Execute: 0.05,
  "Resolve-in-progress": 0.04,
  Resolved: 0.7,
  FailedTerminal: 0.07,
};
const orderPlan = [];
for (const [stage, weight] of Object.entries(STAGE_WEIGHTS)) {
  for (let i = 0; i < Math.round(TOTAL_ORDERS * weight); i++) orderPlan.push(stage);
}

for (const plan of orderPlan) {
  reqN++;
  const loc = pick(locations);
  const complaint = pick(COMPLAINT_CATALOG);
  const request_id = id("req", reqN);
  requests.push({
    request_id,
    source: "nyc_311",
    external_unique_key: String(69_000_000 + reqN),
    location_id: loc.location_id,
    complaint_type: complaint.complaint_type,
    descriptor: complaint.descriptor,
    agency: complaint.agency,
    raw_payload: { unique_key: String(69_000_000 + reqN), complaint_type: complaint.complaint_type, borough: loc.borough },
    status: "promoted",
    created_by: null,
    created_at: isoMinutesAgo(randInt(30, 60 * 20)),
  });

  ordN++;
  const order_id = id("order", ordN);
  const createdMinsAgo = randInt(15, 60 * 18);
  const priority_tier = PRIORITY_BY_COMPLAINT[complaint.complaint_type] ?? "standard";
  let seq = 0;
  const created_at = isoMinutesAgo(createdMinsAgo);

  makeOrderEvent(order_id, seq++, "OrderCreated", null, { request_id }, created_at);
  makeOrderEvent(order_id, seq++, "StageStarted", "Ingest", {}, isoMinutesAgo(createdMinsAgo - 1));
  makeOrderEvent(order_id, seq++, "PriorityAssigned", "Ingest", { priority_tier }, isoMinutesAgo(createdMinsAgo - 2));

  let current_stage = "Ingest";
  let status = "in_progress";
  let assigned_operator_id = null;
  let scheduled_start = null, scheduled_end = null;
  let case_id = null;
  let retry_counts = { Ingest: 0, Schedule: 0, Execute: 0, Resolve: 0 };

  const advanceToSchedule = () => {
    makeOrderEvent(order_id, seq++, "StageSucceeded", "Ingest", {}, isoMinutesAgo(createdMinsAgo - 3));
    makeOrderEvent(order_id, seq++, "StageStarted", "Schedule", {}, isoMinutesAgo(createdMinsAgo - 3));
    current_stage = "Schedule";
  };
  const advanceToExecute = () => {
    scheduled_start = isoMinutesFromNow(randInt(5, 45));
    scheduled_end = isoMinutesFromNow(randInt(60, 120));
    makeOrderEvent(order_id, seq++, "OrderScheduled", "Schedule", { scheduled_start, scheduled_end }, isoMinutesAgo(createdMinsAgo - 4));
    assigned_operator_id = null; // filled in once operators are generated (assignment pass below)
    makeOrderEvent(order_id, seq++, "OrderAssigned", "Schedule", {}, isoMinutesAgo(createdMinsAgo - 4));
    makeOrderEvent(order_id, seq++, "StageSucceeded", "Schedule", {}, isoMinutesAgo(createdMinsAgo - 5));
    makeOrderEvent(order_id, seq++, "StageStarted", "Execute", {}, isoMinutesAgo(createdMinsAgo - 5));
    current_stage = "Execute";
  };
  const advanceToResolve = () => {
    makeOrderEvent(order_id, seq++, "StageSucceeded", "Execute", {}, isoMinutesAgo(createdMinsAgo - 6));
    makeOrderEvent(order_id, seq++, "StageStarted", "Resolve", {}, isoMinutesAgo(createdMinsAgo - 6));
    current_stage = "Resolve";
  };
  const resolve = () => {
    makeOrderEvent(order_id, seq++, "StageSucceeded", "Resolve", {}, isoMinutesAgo(2));
    makeOrderEvent(order_id, seq++, "OrderResolved", null, {}, isoMinutesAgo(1));
    current_stage = "Resolve";
    status = "resolved";
  };

  if (plan === "Ingest") {
    // stays put
  } else if (plan === "Schedule") {
    advanceToSchedule();
  } else if (plan === "Execute") {
    advanceToSchedule();
    advanceToExecute();
    operatorAssignmentPool.push({ order_id, location_id: loc.location_id });
  } else if (plan === "Resolve-in-progress") {
    advanceToSchedule();
    advanceToExecute();
    advanceToResolve();
  } else if (plan === "Resolved") {
    advanceToSchedule();
    advanceToExecute();
    advanceToResolve();
    resolve();
  } else if (plan === "FailedTerminal") {
    advanceToSchedule();
    makeOrderEvent(order_id, seq++, "StageFailed", "Schedule", { reason: "capacity_sla_breach" }, isoMinutesAgo(createdMinsAgo - 6));
    case_id = id("case", 9000 + ordN); // placeholder, relinked to a real case_id below once Cases are generated
    makeOrderEvent(order_id, seq++, "CaseCreated", "Schedule", { case_id }, isoMinutesAgo(createdMinsAgo - 6));
    status = "blocked";
    current_stage = "Schedule";
  }

  orders.push({
    order_id,
    request_id,
    location_id: loc.location_id,
    current_stage,
    status,
    retry_counts,
    priority_tier,
    sla_deadline: isoMinutesFromNow(randInt(-30, 90)),
    scheduled_start,
    scheduled_end,
    assigned_operator_id,
    reassignment_count: 0,
    case_id,
    created_at,
    updated_at: isoMinutesAgo(randInt(1, 20)),
    last_event_sequence: seq - 1,
    _complaint_type: complaint.complaint_type,
    _agency: complaint.agency,
    _borough: loc.borough,
  });
}

// ---------------------------------------------------------------------------
// Cases / CaseEvents
// ---------------------------------------------------------------------------
const cases = [];
const caseEvents = [];
let caseN = 0;

function makeCaseEvent(case_id, seq, event_type, payload, occurred_at, actor) {
  caseEvents.push({ case_id, sequence_number: seq, event_type, payload, occurred_at, actor });
}

const AGENT_CONFIDENCE = () => Number((0.55 + rand() * 0.4).toFixed(2));

function buildCase({ case_type, queue, order_id, request_id, status, minsAgo }) {
  caseN++;
  const case_id = id("case", caseN);
  let seq = 0;
  const created_at = isoMinutesAgo(minsAgo);
  makeCaseEvent(case_id, seq++, "CaseCreated", { case_type, order_id, request_id }, created_at, "system");

  let assigned_owner = null;
  if (status !== "created") {
    makeCaseEvent(case_id, seq++, "AgentInvestigationStarted", {}, isoMinutesAgo(minsAgo - 1), "system");
  }
  if (["auto_resolved", "escalated", "resolved_by_admin", "closed"].includes(status)) {
    const confidence = AGENT_CONFIDENCE();
    const willAutoResolve = status === "auto_resolved" || (status === "closed" && confidence > 0.75);
    makeCaseEvent(
      case_id,
      seq++,
      "AgentInvestigationCompleted",
      {
        model: "claude-3-5-haiku",
        confidence,
        action: willAutoResolve ? pick(["retry_with_adjusted_parameters", "mark_as_duplicate", "close_no_action_needed"]) : null,
        reasoning: willAutoResolve
          ? "Failure pattern matches a known transient condition; safe to retry with adjusted backoff."
          : "Repeated failures with no clear root cause in the available context; recommend human review.",
      },
      isoMinutesAgo(minsAgo - 2),
      "agent"
    );
  }
  if (status === "auto_resolved" || status === "closed") {
    makeCaseEvent(case_id, seq++, "AutoResolved", { action: "retry_with_adjusted_parameters" }, isoMinutesAgo(minsAgo - 3), "agent");
  }
  if (status === "escalated" || status === "resolved_by_admin") {
    makeCaseEvent(case_id, seq++, "EscalatedToHuman", { reason: "Agent confidence below auto-resolve threshold" }, isoMinutesAgo(minsAgo - 3), "agent");
    assigned_owner = users[0].user_id;
  }
  if (status === "resolved_by_admin") {
    makeCaseEvent(case_id, seq++, "AdminResolved", { note: "Manually dispatched a backup unit." }, isoMinutesAgo(Math.max(1, minsAgo - 8)), "admin");
  }
  if (status === "closed") {
    makeCaseEvent(case_id, seq++, "Closed", {}, isoMinutesAgo(Math.max(0, minsAgo - 10)), "system");
  }

  cases.push({
    case_id,
    order_id: order_id ?? null,
    request_id: request_id ?? null,
    case_type,
    queue,
    status,
    sla_deadline: isoMinutesFromNow(randInt(-15, 180)),
    created_by: "user_admin_01",
    assigned_owner,
    created_at,
    updated_at: isoMinutesAgo(Math.max(0, minsAgo - 5)),
  });
  return case_id;
}

// Link the two FailedTerminal orders' pre-seeded case_id placeholders to real cases
const failedOrders = orders.filter((o) => o.status === "blocked");
for (const o of failedOrders) {
  const realCaseId = buildCase({
    case_type: "capacity_sla_breach",
    queue: "capacity-escalation",
    order_id: o.order_id,
    request_id: o.request_id,
    status: pick(["under_investigation", "escalated", "resolved_by_admin"]),
    minsAgo: randInt(10, 90),
  });
  o.case_id = realCaseId;
}

// More standalone cases so both queues have real volume at scale — a random
// sample of still-in-flight (non-blocked, non-resolved) Orders also get a
// case, same as a real ops platform where not every failure halts the Order.
const CASE_STATUS_POOL = ["created", "under_investigation", "auto_resolved", "escalated", "resolved_by_admin", "closed"];
const extraCaseCandidates = orders.filter((o) => o.status === "in_progress");
const EXTRA_CASE_COUNT = Math.min(extraCaseCandidates.length, Math.round(TOTAL_ORDERS * 0.03));
for (let i = 0; i < EXTRA_CASE_COUNT; i++) {
  const idx = randInt(0, extraCaseCandidates.length - 1);
  const [order] = extraCaseCandidates.splice(idx, 1);
  const case_type = rand() > 0.5 ? "workflow_execution_failure" : "capacity_sla_breach";
  buildCase({
    case_type,
    queue: case_type === "capacity_sla_breach" ? "capacity-escalation" : "system-failure",
    order_id: order.order_id,
    request_id: order.request_id,
    status: pick(CASE_STATUS_POOL),
    minsAgo: randInt(3, 180),
  });
}

// A handful of location_resolution_failure cases — these attach to a Request
// directly (no Order exists yet), per data-model.md.
const LOCATION_FAILURE_COUNT = Math.max(2, Math.round(TOTAL_ORDERS * 0.005));
for (let i = 0; i < LOCATION_FAILURE_COUNT; i++) {
  buildCase({
    case_type: "location_resolution_failure",
    queue: "system-failure",
    order_id: null,
    request_id: pick(requests).request_id,
    status: pick(CASE_STATUS_POOL),
    minsAgo: randInt(10, 200),
  });
}

// ---------------------------------------------------------------------------
// Shifts / Operators (+ initial position/destination for the map simulation)
// ---------------------------------------------------------------------------
const POOLS = [
  { pool: "DSNY#QUEENS", agency: "DSNY", borough: "QUEENS" },
  { pool: "DSNY#BROOKLYN", agency: "DSNY", borough: "BROOKLYN" },
  { pool: "NYPD#MANHATTAN", agency: "NYPD", borough: "MANHATTAN" },
  { pool: "NYPD#BRONX", agency: "NYPD", borough: "BRONX" },
  { pool: "DOT#BROOKLYN", agency: "DOT", borough: "BROOKLYN" },
  { pool: "DOT#QUEENS", agency: "DOT", borough: "QUEENS" },
  { pool: "HPD#MANHATTAN", agency: "HPD", borough: "MANHATTAN" },
  { pool: "HPD#BRONX", agency: "HPD", borough: "BRONX" },
  { pool: "DSNY#STATEN ISLAND", agency: "DSNY", borough: "STATEN ISLAND" },
];

const depots = {};
for (const p of POOLS) {
  depots[p.pool] = makeLocation(0, p.borough);
}

const shifts = [];
let shiftN = 0;
for (const p of POOLS) {
  shiftN++;
  const depot = depots[p.pool];
  const active = shiftN % 4 !== 0; // most shifts active, a few scheduled
  shifts.push({
    shift_id: id("shift", shiftN),
    pool: p.pool,
    depot_id: depot.location_id,
    rate_per_hour: pick([38, 42, 45, 52]),
    scheduled_start: active ? isoMinutesAgo(randInt(30, 240)) : isoMinutesFromNow(randInt(30, 300)),
    scheduled_end: active ? isoMinutesFromNow(randInt(60, 240)) : isoMinutesFromNow(randInt(360, 600)),
    status: active ? "active" : "scheduled",
    created_at: isoMinutesAgo(60 * 24 * 3),
    updated_at: isoMinutesAgo(randInt(1, 30)),
  });
}

const operators = [];
const operatorEvents = [];
let opN = 0;
const activeShifts = shifts.filter((s) => s.status === "active");

// Assign each in-flight order (Execute stage) a truck en route/working, cycling through pools
const unassignedByAgency = operatorAssignmentPool.slice();
const onDutyTarget = TOTAL_OPERATORS - OFF_SHIFT_OPERATORS;
let onDutyCreated = 0;
for (const [shiftIdx, shift] of activeShifts.entries()) {
  const pool = POOLS.find((p) => p.pool === shift.pool);
  const depot = depots[shift.pool];
  // spread on-duty operators evenly across active shifts, remainder-aware so
  // the total lands exactly on onDutyTarget regardless of active-shift count
  const remainingShifts = activeShifts.length - shiftIdx;
  const unitsInPool = Math.round((onDutyTarget - onDutyCreated) / remainingShifts);
  onDutyCreated += unitsInPool;
  for (let u = 0; u < unitsInPool; u++) {
    opN++;
    const operator_id = id("operator", opN);
    let current_activity = "idle";
    let destinationLocationId = null;
    let assignedOrderId = null;

    const candidateIdx = unassignedByAgency.findIndex((c) => {
      const order = orders.find((o) => o.order_id === c.order_id);
      return order && order._agency === pool.agency;
    });
    if (candidateIdx !== -1) {
      const [candidate] = unassignedByAgency.splice(candidateIdx, 1);
      const order = orders.find((o) => o.order_id === candidate.order_id);
      current_activity = rand() > 0.5 ? "transit" : "working";
      destinationLocationId = candidate.location_id;
      assignedOrderId = candidate.order_id;
      order.assigned_operator_id = operator_id;
    }

    const startLat = depot.latitude + (rand() - 0.5) * 0.01;
    const startLng = depot.longitude + (rand() - 0.5) * 0.01;

    operators.push({
      operator_id,
      function_type: pool.agency,
      status: "active",
      current_shift_id: shift.shift_id,
      current_activity,
      created_at: isoMinutesAgo(60 * 24 * 120),
      updated_at: isoMinutesAgo(1),
      last_event_sequence: 2,
      // demo-only fields consumed by the tracking simulation (not part of the
      // canonical data model's Operator projection):
      _depot: { latitude: depot.latitude, longitude: depot.longitude },
      _position: { latitude: startLat, longitude: startLng },
      _destination_location_id: destinationLocationId,
      _assigned_order_id: assignedOrderId,
      _display_name: `${pool.agency} Unit ${String(opN).padStart(2, "0")}`,
    });

    let seq = 0;
    operatorEvents.push({ operator_id, sequence_number: seq++, event_type: "CheckedIn", payload: { shift_id: shift.shift_id }, occurred_at: shift.scheduled_start, actor: "system" });
    if (assignedOrderId) {
      operatorEvents.push({ operator_id, sequence_number: seq++, event_type: "TransitStarted", payload: { order_id: assignedOrderId }, occurred_at: isoMinutesAgo(5), actor: "system" });
    }
  }
}

// Off-shift operators for roster variety
for (let i = 0; i < OFF_SHIFT_OPERATORS; i++) {
  opN++;
  const pool = pick(POOLS);
  operators.push({
    operator_id: id("operator", opN),
    function_type: pool.agency,
    status: "active",
    current_shift_id: null,
    current_activity: "off_shift",
    created_at: isoMinutesAgo(60 * 24 * 200),
    updated_at: isoMinutesAgo(randInt(60, 600)),
    last_event_sequence: 1,
    _depot: null,
    _position: null,
    _destination_location_id: null,
    _assigned_order_id: null,
    _display_name: `${pool.agency} Unit ${String(opN).padStart(2, "0")}`,
  });
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outputs = { locations, users, requests, orders, orderEvents, cases, caseEvents, shifts, operators, operatorEvents };
for (const [name, data] of Object.entries(outputs)) {
  writeFileSync(join(__dirname, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${name}.json (${data.length} records)`);
}
