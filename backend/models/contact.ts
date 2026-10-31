import { z } from "zod";

/*
 * Mirrors data-model.md's Contact entity (16-resident-action-models.md §3).
 * Enum values are ALL_CAPS per CLAUDE.md §6.
 */

export const CONTACT_TYPES = ["FEATURE_REQUEST"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_STATUSES = ["RECEIVED", "IN_PROGRESS", "CLOSED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const ContactSubmitterSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().nullable(),
});
export type ContactSubmitter = z.infer<typeof ContactSubmitterSchema>;

export const ContactSchema = z.object({
  contact_id: z.string().min(1),
  contact_type: z.enum(CONTACT_TYPES),
  status: z.enum(CONTACT_STATUSES),
  title: z.string().min(1),
  description: z.string().min(1),
  submitter: ContactSubmitterSchema,
  closure_reason_code: z.string().min(1).nullable(),
  closure_reason_description: z.string().min(1).nullable(),
  client_request_id: z.string().min(1).nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type Contact = z.infer<typeof ContactSchema>;

/* What a caller supplies to create a Contact; the service fills in id, status and timestamps. */
export const CreateContactInputSchema = z.object({
  contact_type: z.enum(CONTACT_TYPES),
  title: z.string().min(1),
  description: z.string().min(1),
  submitter: ContactSubmitterSchema,
  client_request_id: z.string().min(1).nullable(),
});
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;
