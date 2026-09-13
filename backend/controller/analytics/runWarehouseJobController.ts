import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { runWarehouseJob } from "../../service/analytics/warehouseJobRunnerService";
import { WarehouseJobTriggerSchema } from "../../models/warehouseJobTrigger";
import { ValidationError } from "../../models/errors";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";

/**
 * The warehouse job runner's entry point (`7-data-warehousing.md` §8,
 * Leg 8) — invoked by that one job's own EventBridge Scheduler schedule,
 * `{job_name}` as the trigger input. Validates it, delegates to
 * `runWarehouseJob`, and returns the run. A job's own SQL failure is
 * captured as a `FAILED` `WarehouseJobRun` row, not thrown — the runner
 * Lambda only errors on a runner-level fault (missing definition,
 * DynamoDB/S3 unavailable, …).
 */
export const runWarehouseJobController = async (event: unknown, context: Context): Promise<WarehouseJobRun> => {
  logInfo("RunWarehouseJobControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = WarehouseJobTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Warehouse job trigger payload failed validation", parsed.error.issues);
  }

  const run = await runWarehouseJob(parsed.data.job_name);
  logInfo("RunWarehouseJobControllerCompleted", {
    jobName: parsed.data.job_name,
    status: run.status,
    awsRequestId: context.awsRequestId,
  });
  return run;
};
