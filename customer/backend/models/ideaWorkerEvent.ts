import { z } from "zod";

/*
 * What a resident's schedule hands the idea worker (§3 Flow B decision 6).
 * `force` skips the activity roll, for a hand-run invocation.
 */
export const IdeaWorkerEventSchema = z.object({
  persona_id: z.string().min(1),
  force: z.boolean().optional(),
});
export type IdeaWorkerEvent = z.infer<typeof IdeaWorkerEventSchema>;
