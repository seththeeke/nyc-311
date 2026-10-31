import { z } from "zod";

/* One idea to action (docs/16-resident-action-models.md §5.2): the body of an IdeaActions-Prod message. */
export const IdeaActionMessageSchema = z.object({
  persona_id: z.string().min(1),
  idea_id: z.string().min(1),
});
export type IdeaActionMessage = z.infer<typeof IdeaActionMessageSchema>;

/* The slice of an SQS event the action worker reads. */
export const SqsEventSchema = z.object({
  Records: z.array(z.object({ messageId: z.string().min(1), body: z.string() })).min(1),
});
export type SqsEvent = z.infer<typeof SqsEventSchema>;
