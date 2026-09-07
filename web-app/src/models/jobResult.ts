import { z } from "zod";

/*
 * Mirrors backend/models/jobResult.ts (7-data-warehousing.md §11) — the
 * stored output of one job run, as returned verbatim by
 * GET /data/jobs/{name}/result. `columns` carries the Athena type per
 * column; `rows` are string-valued keyed objects (Athena's native
 * output), so a per-job renderer casts what it needs. Every service
 * response is parsed through this schema before it reaches a component
 * (CLAUDE.md §5.1).
 */
export const JobResultColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});
export type JobResultColumn = z.infer<typeof JobResultColumnSchema>;

export const JobResultSchema = z.object({
  job_name: z.string().min(1),
  job_run_id: z.string().min(1),
  run_date: z.string().min(1),
  computed_at: z.string().min(1),
  columns: z.array(JobResultColumnSchema),
  rows: z.array(z.record(z.string(), z.string())),
});
export type JobResult = z.infer<typeof JobResultSchema>;
