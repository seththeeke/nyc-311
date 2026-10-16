import { z } from "zod";

/*
 * One Idea — a persona's "I need something" (13-customer-simulation.md
 * §2/§3), as the planned customer read API would return it. The anchor
 * is a snapshot of the order it is about, so it still renders after the
 * order leaves play; feature requests have none.
 */

export const IDEA_TYPES = [
  "STATUS_CHECK",
  "SERVICED_CHECK",
  "ETA_REQUEST",
  "PRIORITY_INQUIRY",
  "ESCALATION",
  "FEATURE_REQUEST",
] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

export const IDEA_STATUSES = ["OPEN"] as const;

export const IdeaAnchorSchema = z.object({
  order_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
});
export type IdeaAnchor = z.infer<typeof IdeaAnchorSchema>;

/*
 * What the resident did about the idea (13-customer-simulation.md
 * Appendix L) — chosen by their personality. In the first phase ideas go
 * unactioned (`action: null`); requesting a feature is planned to be the
 * first action, with checking status through the API and browsing the
 * website (recorded as RPA) to follow.
 */
export const ACTION_TYPES = ["REQUEST_FEATURE", "CHECK_STATUS_API", "BROWSE_WEBSITE"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = ["COMPLETED", "FAILED"] as const;

const ActionBaseShape = {
  status: z.enum(ACTION_STATUSES),
  started_at: z.string().min(1),
  completed_at: z.string().min(1),
  /* What they did, in plain words. */
  summary: z.string().min(1),
  /* What they came away with; null when there was nothing to learn. */
  outcome: z.string().min(1).nullable(),
};

export const RecordingStepSchema = z.object({
  at_seconds: z.number().min(0),
  description: z.string().min(1),
});
export type RecordingStep = z.infer<typeof RecordingStepSchema>;

export const BrowseWebsiteActionSchema = z.object({
  type: z.literal("BROWSE_WEBSITE"),
  ...ActionBaseShape,
  /* The RPA session. `video_url` is null until recordings are captured; the steps log still describes the session. */
  recording: z.object({
    video_url: z.string().url().nullable(),
    captions_url: z.string().url().nullable(),
    duration_seconds: z.number().positive(),
    steps: z.array(RecordingStepSchema).min(1),
  }),
});

export const CheckStatusApiActionSchema = z.object({
  type: z.literal("CHECK_STATUS_API"),
  ...ActionBaseShape,
  request: z.object({ method: z.string().min(1), url: z.string().min(1) }),
  response: z.object({ status_code: z.number().int(), body: z.string() }),
});

export const RequestFeatureActionSchema = z.object({
  type: z.literal("REQUEST_FEATURE"),
  ...ActionBaseShape,
  feature_request: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    /* The intake system's id for the request, once it accepts one. */
    reference_id: z.string().min(1).nullable(),
  }),
});

export const IdeaActionSchema = z.discriminatedUnion("type", [
  BrowseWebsiteActionSchema,
  CheckStatusApiActionSchema,
  RequestFeatureActionSchema,
]);
export type IdeaAction = z.infer<typeof IdeaActionSchema>;
export type BrowseWebsiteAction = z.infer<typeof BrowseWebsiteActionSchema>;
export type CheckStatusApiAction = z.infer<typeof CheckStatusApiActionSchema>;
export type RequestFeatureAction = z.infer<typeof RequestFeatureActionSchema>;

export const CustomerIdeaSchema = z.object({
  idea_id: z.string().min(1),
  persona_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  anchor: IdeaAnchorSchema.nullable(),
  status: z.enum(IDEA_STATUSES),
  created_at: z.string().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  /* null = not actioned yet. */
  action: IdeaActionSchema.nullable(),
});
export type CustomerIdea = z.infer<typeof CustomerIdeaSchema>;

/* `GET /ideas` and `GET /customers/{id}/ideas` — newest first, paginated with an opaque cursor. */
export const CustomerIdeaPageSchema = z.object({
  items: z.array(CustomerIdeaSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type CustomerIdeaPage = z.infer<typeof CustomerIdeaPageSchema>;
