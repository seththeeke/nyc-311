import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import {
  wipeAndListExport,
  replayExportChunk,
  finalizeRebuild,
  markRebuildFailed,
} from "../../service/analytics/warehouseRebuildService";
import { WarehouseRebuildTaskSchema } from "../../models/warehouseRebuild";
import { ValidationError } from "../../models/errors";

/**
 * The rebuild worker's entry point (`7-data-warehousing.md` §10) — one
 * task per step of `Nyc311WarehouseRebuildStateMachine`, dispatched on
 * `phase` (`wipe` → `replay` ×N via the `Map` → `finalize`; `fail` is the
 * Catch handler). Errors propagate so the state machine fails the branch.
 */
export const warehouseRebuildController = async (event: unknown, context: Context): Promise<unknown> => {
  logInfo("WarehouseRebuildControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = WarehouseRebuildTaskSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Warehouse rebuild task failed validation", parsed.error.issues);
  }
  const task = parsed.data;

  switch (task.phase) {
    case "wipe": {
      const result = await wipeAndListExport(task);
      logInfo("WarehouseRebuildControllerWiped", { source: task.source, chunks: result.chunks.length });
      return result;
    }
    case "replay":
      return replayExportChunk(task);
    case "finalize": {
      const result = await finalizeRebuild(task);
      logInfo("WarehouseRebuildControllerFinalized", { ...result, awsRequestId: context.awsRequestId });
      return result;
    }
    case "fail":
      await markRebuildFailed(task);
      return { source: task.source, status: "FAILED" };
  }
};
