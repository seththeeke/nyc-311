import { z } from "zod";

/** Run status, the same set Phase 3 will use (SPEC.md §3.3). */
export const runStatusSchema = z.enum(["RUNNING", "SUCCEEDED", "FAILED", "SKIPPED", "ABORTED"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

/**
 * One scheduled run, parsed from its log. `runId` is the log's timestamp, e.g.
 * `20261107T140004`. `mode` is free-form: NEW, REVISE, RESUME, IDLE, RUN or a
 * slot mode like AUDIT.
 */
export const runSummarySchema = z.object({
  agent: z.string(),
  runId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: runStatusSchema,
  mode: z.string().nullable(),
  model: z.string().nullable(),
  exitCode: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  chatPostId: z.string().nullable(),
  openPrsBefore: z.string().nullable(),
  openPrsAfter: z.string().nullable(),
  warnings: z.array(z.string()),
  error: z.string().nullable(),
  hasReport: z.boolean(),
  /** Started from the agent monitor's Run button, not by its schedule. */
  manual: z.boolean(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;
