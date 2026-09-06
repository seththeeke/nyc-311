import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { runSampleWarehouseJob } from "../../service/analytics/warehouseJobRunnerService";
import { WarehouseJobTriggerSchema } from "../../models/warehouseJobTrigger";
import { ValidationError } from "../../models/errors";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";

/**
 * The daily warehouse job runner entry point — invoked directly by an
 * EventBridge Scheduler target, `rate(1 day)` (`7-data-warehousing.md`
 * §8). Validates the (empty) trigger, delegates to
 * `runSampleWarehouseJob`, and lets a failure propagate so the schedule's
 * on-failure DLQ still catches it (the run row is already written FAILED
 * by then).
 */
export const runWarehouseJobController = async (event: unknown, context: Context): Promise<WarehouseJobRun> => {
  logInfo("RunWarehouseJobControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = WarehouseJobTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Warehouse job trigger payload failed validation", parsed.error.issues);
  }

  const run = await runSampleWarehouseJob();
  logInfo("RunWarehouseJobControllerCompleted", {
    jobRunId: run.job_run_id,
    status: run.status,
    awsRequestId: context.awsRequestId,
  });
  return run;
};
