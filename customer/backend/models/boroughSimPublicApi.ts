import { z } from "zod";

/*
 * The customer's own copy of the BoroughSim public API shapes it uses
 * (docs/16-resident-action-models.md §2.4). Copied, never imported: the
 * customer reaches BoroughSim only as an outsider (CLAUDE.md §5.4). The
 * API is additive-only, so unknown fields are passed through, not rejected.
 */

export const SERVICE_REQUEST_STATUSES = ["RECEIVED", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "NOT_SERVICED"] as const;
export const FEATURE_REQUEST_STATUSES = ["RECEIVED", "UNDER_REVIEW", "CLOSED"] as const;

/*
 * A known status, or one BoroughSim adds later: `string & {}` keeps the
 * known values visible to the type checker without rejecting a new one,
 * and the parsers below accept it too, since the API is additive-only.
 */
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number] | (string & {});
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number] | (string & {});
export const ServiceRequestStatusSchema: z.ZodType<ServiceRequestStatus> = z.union([z.enum(SERVICE_REQUEST_STATUSES), z.string().min(1)]);
export const FeatureRequestStatusSchema: z.ZodType<FeatureRequestStatus> = z.union([z.enum(FEATURE_REQUEST_STATUSES), z.string().min(1)]);

/* The one feature request status code branches on; `satisfies` makes a typo a compile error. */
export const CLOSED_FEATURE_REQUEST_STATUS = "CLOSED" satisfies (typeof FEATURE_REQUEST_STATUSES)[number];

export const ScheduledWindowSchema = z.object({ start: z.string().min(1), end: z.string().min(1) });
export type ScheduledWindow = z.infer<typeof ScheduledWindowSchema>;

export const ServiceRequestSchema = z
  .object({
    order_id: z.string().min(1),
    status: ServiceRequestStatusSchema,
    status_reason_description: z.string().nullable(),
    scheduled_window: ScheduledWindowSchema.nullable(),
    status_updated_at: z.string().min(1),
  })
  .passthrough();
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;

export const SearchRequestsResponseSchema = z.object({ items: z.array(ServiceRequestSchema), next_cursor: z.string().nullable() }).passthrough();

export const FeatureRequestSchema = z
  .object({
    feature_request_id: z.string().min(1),
    status: FeatureRequestStatusSchema,
    status_reason_description: z.string().nullable(),
    title: z.string().min(1),
  })
  .passthrough();
export type FeatureRequest = z.infer<typeof FeatureRequestSchema>;

/* The limits BoroughSim enforces on a new feature request; the tool spec tells the model the same numbers (#240). */
export const FEATURE_REQUEST_TITLE_LENGTH = { min: 5, max: 120 } as const;
export const FEATURE_REQUEST_DESCRIPTION_LENGTH = { min: 10, max: 2000 } as const;

/* Checked before calling, so a bad input never reaches BoroughSim. */
export const FeatureRequestDraftSchema = z.object({
  title: z.string().trim().min(FEATURE_REQUEST_TITLE_LENGTH.min).max(FEATURE_REQUEST_TITLE_LENGTH.max),
  description: z.string().trim().min(FEATURE_REQUEST_DESCRIPTION_LENGTH.min).max(FEATURE_REQUEST_DESCRIPTION_LENGTH.max),
});
export type FeatureRequestDraft = z.infer<typeof FeatureRequestDraftSchema>;
