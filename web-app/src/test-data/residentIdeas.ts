import { notActionedResolution, type IdeaAnchor, type IdeaResolution, type IdeaStep, type IdeaType, type ResidentIdea, type ResolutionStatus } from "../models/residentIdea";

/* Sample Ideas for the resident mocks — a few orders followed more than once, plus feature requests with no anchor. */

const ATLANTIC: IdeaAnchor = {
  order_id: "01K7A1ATLANTIC000000000000",
  external_unique_key: "69860415",
  descriptor: "Pothole",
  borough: "BROOKLYN",
  address: "412 ATLANTIC AVENUE",
};
const FLATBUSH: IdeaAnchor = {
  order_id: "01K7A1FLATBUSH000000000000",
  external_unique_key: "69871102",
  descriptor: "Cave-in",
  borough: "BROOKLYN",
  address: "88 FLATBUSH AVENUE",
};
const FORTY_FIRST: IdeaAnchor = {
  order_id: "01K7A1FORTYFIRST0000000000",
  external_unique_key: "69844930",
  descriptor: "Pothole",
  borough: "QUEENS",
  address: "70-12 41 AVENUE",
};
const CONCOURSE: IdeaAnchor = {
  order_id: "01K7A1CONCOURSE00000000000",
  external_unique_key: "69852277",
  descriptor: "Defective Hardware",
  borough: "BRONX",
  address: "1650 GRAND CONCOURSE",
};

function idea(
  id: string,
  personaId: string,
  type: IdeaType,
  anchor: IdeaAnchor | null,
  createdAt: string,
  text: string,
  resolution: IdeaResolution = notActionedResolution()
): ResidentIdea {
  return {
    idea_id: id,
    persona_id: personaId,
    persona_version: 1,
    idea_type: type,
    text,
    anchor,
    feature_request_id: null,
    resolution,
    created_at: createdAt,
    model_id: "amazon.nova-micro-v1:0",
    prompt_version: "idea-generator@2",
    input_tokens: 412,
    output_tokens: 74,
  };
}

/* How each worked idea ended (docs/16 §5.3); one of every outcome, matched to personality. */
function resolved(status: ResolutionStatus, startedAt: string, steps: IdeaStep[], summary: string | null, followUp: string | null = null): IdeaResolution {
  const last = steps[steps.length - 1];
  return {
    status,
    summary,
    follow_up: followUp,
    tools_used: [...new Set(steps.flatMap((step) => (step.kind === "TOOL_CALL" && step.decision ? [step.decision.tool] : [])))],
    step_count: steps.length,
    last_step_sequence: last?.sequence ?? 0,
    started_at: startedAt,
    finished_at: status === "IN_PROGRESS" ? null : (last?.created_at ?? startedAt),
    prompt_version: "idea-actioner@1",
    input_tokens: steps.reduce((sum, step) => sum + step.input_tokens, 0),
    output_tokens: steps.reduce((sum, step) => sum + step.output_tokens, 0),
  };
}

function search(sequence: number, at: string, anchor: IdeaAnchor, status: number, summary: string, body: unknown, modelText: string | null = null): IdeaStep {
  return {
    sequence,
    kind: "TOOL_CALL",
    decision: { tool: "SEARCH_REQUESTS", input: {}, model_text: modelText },
    execution: {
      status: status === 200 ? "COMPLETED" : "FAILED",
      summary,
      request: { method: "POST", path: "/v1/requests/search", body: { search_params: { order_id: anchor.order_id } } },
      response: { status_code: status, call_id: `01K8CALL${sequence}${anchor.order_id.slice(-4)}000000000`, body },
      error: status === 200 ? null : summary,
      started_at: at,
      completed_at: at.replace(/\.000Z$/, ".420Z"),
    },
    input_tokens: 900,
    output_tokens: 40,
    created_at: at,
  };
}

function fileRequest(sequence: number, at: string, title: string, description: string, id: string, modelText: string | null = null): IdeaStep {
  return {
    sequence,
    kind: "TOOL_CALL",
    decision: { tool: "CREATE_FEATURE_REQUEST", input: { title, description }, model_text: modelText },
    execution: {
      status: "COMPLETED",
      summary: `Filed feature request ${id}: "${title}" (received).`,
      request: { method: "POST", path: "/v1/feature-requests", body: { title, description, submitted_by: { name: "Resident", email: null } } },
      response: { status_code: 201, call_id: `01K8CALLFR${id.slice(-4)}000000000000`, body: { feature_request_id: id, status: "RECEIVED", title } },
      error: null,
      started_at: at,
      completed_at: at.replace(/\.000Z$/, ".610Z"),
    },
    input_tokens: 950,
    output_tokens: 90,
    created_at: at,
  };
}

function finish(sequence: number, at: string, resolution: string, summary: string): IdeaStep {
  return { sequence, kind: "FINISH", decision: { tool: "finish_idea", input: { resolution, summary }, model_text: null }, execution: null, input_tokens: 1000, output_tokens: 50, created_at: at };
}

const scheduledOn = (anchor: IdeaAnchor) => ({
  items: [{ order_id: anchor.order_id, status: "SCHEDULED", status_reason_description: null, scheduled_window: { start: "2026-10-16T13:00:00.000Z", end: "2026-10-16T15:00:00.000Z" } }],
  next_cursor: null,
});
const acceptedOnly = (anchor: IdeaAnchor) => ({
  items: [{ order_id: anchor.order_id, status: "ACCEPTED", status_reason_description: null, scheduled_window: null }],
  next_cursor: null,
});

/* Each worked idea's step log, served with the idea on the detail view. */
export const MOCK_IDEA_STEPS: Record<string, IdeaStep[]> = {
  "01K7IDEA0007": [
    search(1, "2026-10-13T12:10:30.000Z", ATLANTIC, 200, "Found it: scheduled, 16 Oct 13:00–15:00.", scheduledOn(ATLANTIC), "Let me see if they've actually booked it."),
    finish(2, "2026-10-13T12:10:33.000Z", "SATISFIED", "Booked for Thursday afternoon. Fine. I'll believe it when the vans can park."),
  ],
  "01K7IDEA0014": [
    search(1, "2026-10-14T16:43:00.000Z", ATLANTIC, 200, "Found it: accepted, not yet scheduled.", acceptedOnly(ATLANTIC)),
    finish(2, "2026-10-14T16:43:04.000Z", "GAVE_UP", "Still no date. There's nobody to escalate to on there, so I'm not wasting more time on it."),
  ],
  "01K7IDEA0009": [
    search(1, "2026-10-13T23:49:00.000Z", CONCOURSE, 429, "BoroughSim answered 429", "Too Many Requests", "Is it fixed?"),
    fileRequest(2, "2026-10-13T23:52:00.000Z", "A status page I can check myself", "One place to look up an order by its 311 number and see whether it's fixed.", "01K8FR000000000000000000004"),
    finish(3, "2026-10-13T23:52:05.000Z", "UNSATISFIED", "Couldn't even look it up. Asked them for a page I can check."),
  ],
  "01K7IDEA0013": [
    search(1, "2026-10-14T14:06:00.000Z", FORTY_FIRST, 200, "Found it: accepted, not yet scheduled.", acceptedOnly(FORTY_FIRST), "I'll just have a look."),
    search(2, "2026-10-14T14:06:30.000Z", FORTY_FIRST, 200, "Found it: accepted, not yet scheduled.", acceptedOnly(FORTY_FIRST), "Perhaps once more."),
    search(3, "2026-10-14T14:07:00.000Z", FORTY_FIRST, 200, "Found it: accepted, not yet scheduled.", acceptedOnly(FORTY_FIRST)),
    { sequence: 4, kind: "FORCED_FINISH", decision: null, execution: null, input_tokens: 0, output_tokens: 0, created_at: "2026-10-14T14:07:40.000Z" },
  ],
  "01K7IDEA0012": [search(1, "2026-10-14T11:21:00.000Z", FLATBUSH, 200, "Found it: accepted, not yet scheduled.", acceptedOnly(FLATBUSH))],
  "01K7IDEA0011": [
    fileRequest(1, "2026-10-14T05:13:00.000Z", "Text alerts when a crew is on my street", "Send a text when a crew is dispatched to an order I reported, and again when it's fixed.", "01K8FR000000000000000000003"),
    finish(2, "2026-10-14T05:13:04.000Z", "SATISFIED", "Asked for texts. We'll see."),
  ],
  "01K7IDEA0004": [
    fileRequest(1, "2026-10-12T17:46:00.000Z", "Every open job on my block, with dates", "One page listing the open repairs on a block and when each is due.", "01K8FR000000000000000000001"),
    finish(2, "2026-10-12T17:46:05.000Z", "SATISFIED", "Filed it. If nothing changes in a week I'm asking again."),
  ],
};

const steps = (id: string) => MOCK_IDEA_STEPS[id];

export const MOCK_RESIDENT_IDEAS: ResidentIdea[] = [
  idea("01K7IDEA0014", "hawthorn", "ESCALATION", ATLANTIC, "2026-10-14T16:42:00.000Z", "Three days now. The van bottomed out again at 5am. I need a name and a date, not a ticket number.", resolved("GAVE_UP", "2026-10-14T16:43:00.000Z", steps("01K7IDEA0014"), "Still no date. There's nobody to escalate to on there, so I'm not wasting more time on it.")),
  idea("01K7IDEA0013", "sycamore", "STATUS_CHECK", FORTY_FIRST, "2026-10-14T14:05:00.000Z", "I'd like to know where the repair on 41st Avenue stands. Mrs. Alvarez's cart caught the edge of it yesterday — no harm done, thankfully.", resolved("MAX_DEPTH_REACHED", "2026-10-14T14:06:00.000Z", steps("01K7IDEA0013"), null)),
  idea("01K7IDEA0012", "hawthorn", "ETA_REQUEST", FLATBUSH, "2026-10-14T11:20:00.000Z", "When is the cave-in on Flatbush getting fixed? I'm rerouting deliveries around it and it's costing me an hour a day.", resolved("IN_PROGRESS", "2026-10-14T11:21:00.000Z", steps("01K7IDEA0012"), null)),
  idea("01K7IDEA0011", "juniper", "FEATURE_REQUEST", null, "2026-10-14T05:12:00.000Z", "Text me when a crew is actually on my street. Don't want to call.", resolved("SATISFIED", "2026-10-14T05:13:00.000Z", steps("01K7IDEA0011"), "Asked for texts. We'll see.")),
  idea("01K7IDEA0010", "hawthorn", "PRIORITY_INQUIRY", ATLANTIC, "2026-10-14T07:55:00.000Z", "Is a pothole in front of a business that takes 40 deliveries a week treated any differently? It should be."),
  idea("01K7IDEA0009", "juniper", "SERVICED_CHECK", CONCOURSE, "2026-10-13T23:48:00.000Z", "Grate on the Concourse. Fixed yet? Rode past at 4. Still loose.", resolved("UNSATISFIED", "2026-10-13T23:49:00.000Z", steps("01K7IDEA0009"), "Couldn't even look it up. Asked them for a page I can check.", "Check the Concourse grate on my way in Thursday.")),
  idea("01K7IDEA0008", "sycamore", "SERVICED_CHECK", FORTY_FIRST, "2026-10-13T15:30:00.000Z", "Has anyone been out to look at the hole on 41st Avenue? I walked by this morning and couldn't tell if it had been marked."),
  idea("01K7IDEA0007", "hawthorn", "STATUS_CHECK", ATLANTIC, "2026-10-13T12:10:00.000Z", "Status on the Atlantic Avenue pothole. It was accepted two days ago. What's happening?", resolved("SATISFIED", "2026-10-13T12:10:30.000Z", steps("01K7IDEA0007"), "Booked for Thursday afternoon. Fine. I'll believe it when the vans can park.")),
  idea("01K7IDEA0006", "sycamore", "FEATURE_REQUEST", null, "2026-10-13T09:02:00.000Z", "It would be lovely to see, on a map, which repairs near me are scheduled — so I could tell the neighbours."),
  idea("01K7IDEA0005", "juniper", "ETA_REQUEST", CONCOURSE, "2026-10-13T02:31:00.000Z", "ETA on the Concourse grate?"),
  idea("01K7IDEA0004", "hawthorn", "FEATURE_REQUEST", null, "2026-10-12T17:45:00.000Z", "Let me see every open job on my block in one place, with dates. I'm not calling three times a week.", resolved("SATISFIED", "2026-10-12T17:46:00.000Z", steps("01K7IDEA0004"), "Filed it. If nothing changes in a week I'm asking again.", "Check the block page request next week.")),
  idea("01K7IDEA0003", "sycamore", "ETA_REQUEST", FORTY_FIRST, "2026-10-12T10:15:00.000Z", "Could someone give me a rough idea of when the crew might come by 41st Avenue? No rush, I just like to know."),
  idea("01K7IDEA0002", "juniper", "STATUS_CHECK", CONCOURSE, "2026-10-12T04:40:00.000Z", "Reported a loose grate on the Concourse. Anything?"),
  idea("01K7IDEA0001", "hawthorn", "STATUS_CHECK", FLATBUSH, "2026-10-12T08:05:00.000Z", "Flatbush cave-in. Who's on it?"),
];
