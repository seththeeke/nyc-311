import { z } from "zod";

/*
 * Mirrors data-model.md's Request entity. complaint_type/descriptor/agency
 * are nullable per 1-data-ingestion.md §4's lenient decision; only
 * external_unique_key and created_at are truly required. Enum values are
 * ALL_CAPS per CLAUDE.md §6.
 */

export const REQUEST_STATUSES = [
  "DRAFT",
  "PENDING",
  "PROMOTED",
  "FILTERED",
  "DUPLICATE",
  "REJECTED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const RequestSchema = z.object({
  request_id: z.string().min(1),
  source: z.literal("NYC_311"),
  external_unique_key: z.string().min(1),
  location_id: z.string().min(1).nullable(),
  complaint_type: z.string().min(1).nullable(),
  descriptor: z.string().min(1).nullable(),
  agency: z.string().min(1).nullable(),
  raw_payload: z.record(z.string(), z.unknown()),
  status: z.enum(REQUEST_STATUSES),
  created_by: z.null(),
  created_at: z.string().min(1),
});

export type Request = z.infer<typeof RequestSchema>;
