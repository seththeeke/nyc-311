import { z } from "zod";

/*
 * A Contact status change (17-executive-team.md §17.3). IN_PROGRESS names
 * the tracking ticket; CLOSED gives a reason code. The description is
 * written for the resident, who reads it as `status_reason_description`.
 */
export const CONTACT_CLOSURE_REASONS = ["DUPLICATE", "DECLINED", "SHIPPED"] as const;
export type ContactClosureReason = (typeof CONTACT_CLOSURE_REASONS)[number];

const description = z.string().trim().min(1).max(500);
const ticketNumber = z.number().int().positive();

export const UpdateContactInputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("IN_PROGRESS"), ticket_number: ticketNumber, status_reason_description: description }).strict(),
  z
    .object({ status: z.literal("CLOSED"), closure_reason_code: z.enum(CONTACT_CLOSURE_REASONS), status_reason_description: description, ticket_number: ticketNumber.nullable().default(null) })
    .strict(),
]);
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;

export const UpdateContactParamsSchema = z.object({ contact_id: z.string().min(1) });
