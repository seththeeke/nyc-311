import { z } from "zod";

// Mirrors data-model.md's Request entity exactly (field names, nullability).
// complaint_type/descriptor/agency are nullable per 1-data-ingestion.md §4's
// lenient decision: a record missing them still gets stored as a `DRAFT`
// Request rather than rejected. Only external_unique_key and created_at are
// genuinely required — dedup and cursor ordering can't function without them.
//
// Enum/constant string values are ALL_CAPS, per CLAUDE.md §6 — data-model.md
// documents these same values in lowercase for readability; the code
// representation is the ALL_CAPS form.

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
