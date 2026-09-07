import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { runWarehouseJobs } from "../../service/analytics/warehouseJobRunnerService";
import { WarehouseJobTriggerSchema } from "../../models/warehouseJobTrigger";
import { ValidationError } from "../../models/errors";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";

/**
 * The daily warehouse job runner entry point (`7-data-warehousing.md`
 * §8) — invoked by an EventBridge Scheduler target, `rate(1 day)`.
 * Validates the (empty) trigger, delegates to `runWarehouseJobs`, and
 * returns every run. Per-job failures are captured as `FAILED`
 * `WarehouseJobRun` rows, not thrown — the runner Lambda only errors on a
 * runner-level fault (bad manifest, DynamoDB unavailable, …).
 */
export const runWarehouseJobController = async (event: unknown, context: Context): Promise<WarehouseJobRun[]> => {
  logInfo("RunWarehouseJobControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = WarehouseJobTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Warehouse job trigger payload failed validation", parsed.error.issues);
  }

  const runs = await runWarehouseJobs();
  logInfo("RunWarehouseJobControllerCompleted", {
    total: runs.length,
    failed: runs.filter((r) => r.status === "FAILED").map((r) => r.job_name),
    awsRequestId: context.awsRequestId,
  });
  return runs;
};
