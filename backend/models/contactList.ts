import { z } from "zod";
import { CONTACT_STATUSES, CONTACT_TYPES } from "./contact";

/* The Contacts list (17-executive-team.md §17.3): query, public row and page. */

export const CONTACT_LIST_ORDERS = ["NEWEST", "OLDEST"] as const;
export type ContactListOrder = (typeof CONTACT_LIST_ORDERS)[number];

export const CONTACT_LIST_MAX_LIMIT = 100;

export const ListContactsQuerySchema = z.object({
  type: z.enum(CONTACT_TYPES).default("FEATURE_REQUEST"),
  status: z.enum(CONTACT_STATUSES).optional(),
  order: z.enum(CONTACT_LIST_ORDERS).default("NEWEST"),
  limit: z.coerce.number().int().min(1).max(CONTACT_LIST_MAX_LIMIT).default(25),
  cursor: z.string().min(1).optional(),
});
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

/** A Contact as the public list shows it: no email, no idempotency key. */
export const ContactListItemSchema = z.object({
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
export type ContactListItem = z.infer<typeof ContactListItemSchema>;

export const ContactListPageSchema = z.object({
  contacts: z.array(ContactListItemSchema),
  next_cursor: z.string().min(1).nullable(),
});
export type ContactListPage = z.infer<typeof ContactListPageSchema>;
