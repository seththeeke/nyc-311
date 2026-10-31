import { z } from "zod";
import { TimestampSchema, UlidSchema } from "./publicApiPrimitives";

/*
 * Feature requests (16-resident-action-models.md §2.4.2–§2.4.3). Stored as
 * a Contact of type FEATURE_REQUEST; nothing here names the Contact.
 */

export const FEATURE_REQUEST_STATUSES = ["RECEIVED", "UNDER_REVIEW", "CLOSED"] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];

/* Largest accepted request body, in bytes. */
export const FEATURE_REQUEST_MAX_BODY_BYTES = 8 * 1024;

export const CreateFeatureRequestBodySchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().min(10).max(2000),
    submitted_by: z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().email().nullable().optional(),
      })
      .strict(),
  })
  .strict();
export type CreateFeatureRequestBody = z.infer<typeof CreateFeatureRequestBodySchema>;

export const FeatureRequestIdParamsSchema = z.object({
  feature_request_id: UlidSchema,
});

export const FeatureRequestSchema = z.object({
  feature_request_id: UlidSchema,
  status: z.enum(FEATURE_REQUEST_STATUSES),
  status_reason_description: z.string().min(1).nullable(),
  title: z.string().min(1),
  description: z.string().min(1),
  submitted_by: z.object({ name: z.string().min(1) }).strict(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});
export type FeatureRequest = z.infer<typeof FeatureRequestSchema>;
