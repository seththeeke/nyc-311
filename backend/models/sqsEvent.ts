import { z } from "zod";

/* Minimal SQS Lambda event shape any SQS-triggered controller needs (CLAUDE.md §5.2) — generic, not Request-specific. */

export const SqsRecordSchema = z.object({
  messageId: z.string().min(1),
  body: z.string(),
  /* SQS system attributes, e.g. `ApproximateReceiveCount` — optional so a hand-built test event stays valid. */
  attributes: z.record(z.string(), z.string()).optional(),
});
export type SqsRecord = z.infer<typeof SqsRecordSchema>;

export const SqsEventSchema = z.object({
  Records: z.array(SqsRecordSchema),
});
export type SqsEvent = z.infer<typeof SqsEventSchema>;
