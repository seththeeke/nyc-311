import { z } from "zod";

/* Minimal SQS Lambda event shape any SQS-triggered controller needs (CLAUDE.md §5.2) — generic, not Request-specific. */

export const SqsRecordSchema = z.object({
  messageId: z.string().min(1),
  body: z.string(),
});
export type SqsRecord = z.infer<typeof SqsRecordSchema>;

export const SqsEventSchema = z.object({
  Records: z.array(SqsRecordSchema),
});
export type SqsEvent = z.infer<typeof SqsEventSchema>;
