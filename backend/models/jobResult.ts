import { z } from "zod";

/*
 * The stored output of one job run (`7-data-warehousing.md` §11) — the
 * Athena resultset, verbatim, as a self-describing envelope written to
 * `job-results/job_name=<job>/run_date=<date>/result.json` and returned
 * unchanged by `GET /data/jobs/{name}/result`. The runner never inspects
 * what a query returns; `columns` carries the Athena type per column and
 * `rows` are string-valued (Athena's native output), so any consumer
 * casts what it needs. The web-app mirrors this (`web-app/src/models/
 * jobResult.ts`).
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
