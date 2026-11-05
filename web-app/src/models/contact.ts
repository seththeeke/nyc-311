import { z } from "zod";

/* A Contact as `GET /contacts` lists it (docs/17-executive-team.md §17.3): never an email. */

export const CONTACT_TYPES = ["FEATURE_REQUEST"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_STATUSES = ["RECEIVED", "IN_PROGRESS", "CLOSED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_LIST_ORDERS = ["NEWEST", "OLDEST"] as const;
export type ContactListOrder = (typeof CONTACT_LIST_ORDERS)[number];

export const ContactSchema = z.object({
  contact_id: z.string().min(1),
  contact_type: z.enum(CONTACT_TYPES),
  status: z.enum(CONTACT_STATUSES),
  title: z.string().min(1),
  description: z.string().min(1),
  submitter_name: z.string().min(1),
  closure_reason_code: z.string().min(1).nullable(),
  closure_reason_description: z.string().min(1).nullable(),
  ticket_number: z.number().int().positive().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type Contact = z.infer<typeof ContactSchema>;

export const ContactPageSchema = z.object({
  contacts: z.array(ContactSchema),
  next_cursor: z.string().min(1).nullable(),
});
export type ContactPage = z.infer<typeof ContactPageSchema>;

export interface ContactQuery {
  type: ContactType;
  status: ContactStatus | null;
  order: ContactListOrder;
}
