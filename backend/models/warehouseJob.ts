import { z } from "zod";

/*
 * One registered warehouse job (`7-data-warehousing.md` §8) — a name and
 * its Athena SQL. The CDK reads every `cdk/warehouse/sql/*.sql` at synth
 * and passes the array as the runner Lambda's `WAREHOUSE_JOBS` env var;
 * the runner parses it through this schema (a trust boundary — env, not
 * code) before iterating. `name` is the `.sql` file's basename and is
 * used verbatim as the S3 partition value and the `WarehouseJobRuns.job_name`.
 */
export const WarehouseJobSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "job name must be lower_snake_case (S3 partition-safe)"),
  sql: z.string().min(1),
});
export type WarehouseJob = z.infer<typeof WarehouseJobSchema>;

export const WarehouseJobManifestSchema = z.array(WarehouseJobSchema).min(1);
export type WarehouseJobManifest = z.infer<typeof WarehouseJobManifestSchema>;
