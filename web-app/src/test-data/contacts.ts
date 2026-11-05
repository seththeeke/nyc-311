import type { Contact } from "../models/contact";

/* Baked feature requests for mock mode's Contacts page. */
export const MOCK_CONTACTS: readonly Contact[] = [
  {
    contact_id: "01MOCKCONTACT0000000000003",
    contact_type: "FEATURE_REQUEST",
    status: "RECEIVED",
    title: "Text me when a repair near me is scheduled",
    description: "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
    submitter_name: "Hawthorn",
    closure_reason_code: null,
    closure_reason_description: null,
    ticket_number: null,
    created_at: "2026-11-04T22:14:02.000Z",
    updated_at: "2026-11-04T22:14:02.000Z",
  },
  {
    contact_id: "01MOCKCONTACT0000000000002",
    contact_type: "FEATURE_REQUEST",
    status: "IN_PROGRESS",
    title: "Show an estimated fix date on my request",
    description: "When I report a pothole I'd like to see roughly when someone will get to it.",
    submitter_name: "Marisol",
    closure_reason_code: null,
    closure_reason_description: "We're tracking this as ticket #170.",
    ticket_number: 170,
    created_at: "2026-11-03T15:02:00.000Z",
    updated_at: "2026-11-04T14:00:00.000Z",
  },
  {
    contact_id: "01MOCKCONTACT0000000000001",
    contact_type: "FEATURE_REQUEST",
    status: "CLOSED",
    title: "Notify me when my street is fixed",
    description: "A message when the work on my block is done would be great.",
    submitter_name: "Otis",
    closure_reason_code: "DUPLICATE",
    closure_reason_description: "Same as ticket #170, which we're already tracking.",
    ticket_number: 170,
    created_at: "2026-11-02T09:30:00.000Z",
    updated_at: "2026-11-04T14:05:00.000Z",
  },
];
