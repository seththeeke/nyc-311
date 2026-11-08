import { z } from "zod";
import { runSummarySchema } from "./run.ts";

/** A run's summary plus the agent's final report (`<runId>.report.md`), when there is one. */
export const runDetailSchema = runSummarySchema.extend({
  report: z.string().nullable(),
});
export type RunDetail = z.infer<typeof runDetailSchema>;
