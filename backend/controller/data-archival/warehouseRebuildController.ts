import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { rebuildSource } from "../../service/analytics/warehouseRebuildService";
import { WarehouseRebuildTaskSchema } from "../../models/warehouseRebuild";
import { ValidationError } from "../../models/errors";
import type { WarehouseRebuildResult } from "../../models/warehouseRebuild";

/**
 * The rebuild worker's entry point (`7-data-warehousing.md` §10) — one
 * task per branch of `Nyc311WarehouseRebuildStateMachine`, invoked once
 * that source's PITR export has reached `COMPLETED`. Validates the task
 * shape, delegates to `rebuildSource`, returns the per-table replay
 * counts. Lets the service's error propagate so the Step Functions
 * branch fails on a bad rebuild.
 */
export const warehouseRebuildController = async (
  event: unknown,
  context: Context
): Promise<WarehouseRebuildResult> => {
  logInfo("WarehouseRebuildControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = WarehouseRebuildTaskSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Warehouse rebuild task failed validation", parsed.error.issues);
  }

  const result = await rebuildSource(parsed.data);
  logInfo("WarehouseRebuildControllerCompleted", { ...result, awsRequestId: context.awsRequestId });
  return result;
};
