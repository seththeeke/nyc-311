import type { CustomerIdea, IdeaAnchor, IdeaType } from "../models/customerIdea";

/* Sample Ideas for the customer mocks — a few orders followed more than once, plus feature requests with no anchor. */

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

function idea(id: string, personaId: string, type: IdeaType, anchor: IdeaAnchor | null, createdAt: string, text: string): CustomerIdea {
  return {
    idea_id: id,
    persona_id: personaId,
    persona_version: 1,
    idea_type: type,
    text,
    anchor,
    status: "OPEN",
    created_at: createdAt,
    model_id: "amazon.nova-micro-v1:0",
    prompt_version: "idea-v1",
    input_tokens: 412,
    output_tokens: 74,
  };
}

export const MOCK_CUSTOMER_IDEAS: CustomerIdea[] = [
  idea("01K7IDEA0014", "hawthorn", "ESCALATION", ATLANTIC, "2026-10-14T16:42:00.000Z", "Three days now. The van bottomed out again at 5am. I need a name and a date, not a ticket number."),
  idea("01K7IDEA0013", "sycamore", "STATUS_CHECK", FORTY_FIRST, "2026-10-14T14:05:00.000Z", "I'd like to know where the repair on 41st Avenue stands. Mrs. Alvarez's cart caught the edge of it yesterday — no harm done, thankfully."),
  idea("01K7IDEA0012", "hawthorn", "ETA_REQUEST", FLATBUSH, "2026-10-14T11:20:00.000Z", "When is the cave-in on Flatbush getting fixed? I'm rerouting deliveries around it and it's costing me an hour a day."),
  idea("01K7IDEA0011", "juniper", "FEATURE_REQUEST", null, "2026-10-14T05:12:00.000Z", "Text me when a crew is actually on my street. Don't want to call."),
  idea("01K7IDEA0010", "hawthorn", "PRIORITY_INQUIRY", ATLANTIC, "2026-10-14T07:55:00.000Z", "Is a pothole in front of a business that takes 40 deliveries a week treated any differently? It should be."),
  idea("01K7IDEA0009", "juniper", "SERVICED_CHECK", CONCOURSE, "2026-10-13T23:48:00.000Z", "Grate on the Concourse. Fixed yet? Rode past at 4. Still loose."),
  idea("01K7IDEA0008", "sycamore", "SERVICED_CHECK", FORTY_FIRST, "2026-10-13T15:30:00.000Z", "Has anyone been out to look at the hole on 41st Avenue? I walked by this morning and couldn't tell if it had been marked."),
  idea("01K7IDEA0007", "hawthorn", "STATUS_CHECK", ATLANTIC, "2026-10-13T12:10:00.000Z", "Status on the Atlantic Avenue pothole. It was accepted two days ago. What's happening?"),
  idea("01K7IDEA0006", "sycamore", "FEATURE_REQUEST", null, "2026-10-13T09:02:00.000Z", "It would be lovely to see, on a map, which repairs near me are scheduled — so I could tell the neighbours."),
  idea("01K7IDEA0005", "juniper", "ETA_REQUEST", CONCOURSE, "2026-10-13T02:31:00.000Z", "ETA on the Concourse grate?"),
  idea("01K7IDEA0004", "hawthorn", "FEATURE_REQUEST", null, "2026-10-12T17:45:00.000Z", "Let me see every open job on my block in one place, with dates. I'm not calling three times a week."),
  idea("01K7IDEA0003", "sycamore", "ETA_REQUEST", FORTY_FIRST, "2026-10-12T10:15:00.000Z", "Could someone give me a rough idea of when the crew might come by 41st Avenue? No rush, I just like to know."),
  idea("01K7IDEA0002", "juniper", "STATUS_CHECK", CONCOURSE, "2026-10-12T04:40:00.000Z", "Reported a loose grate on the Concourse. Anything?"),
  idea("01K7IDEA0001", "hawthorn", "STATUS_CHECK", FLATBUSH, "2026-10-12T08:05:00.000Z", "Flatbush cave-in. Who's on it?"),
];
