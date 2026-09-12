import { logError, logInfo } from "../../logger";
import { OrderExecutionTaskSchema, type DispatchResult } from "../../models/orderExecutionTask";
import { ValidationError } from "../../models/errors";
import { arriveAtJob, dispatchOrder, resolveOrder } from "../../service/execution/orderExecutionService";

/**
 * `Nyc311OrderExecutionLambda` — one phase-routed Lambda backing every
 * Task in the order-execution state machine
 * (`10-capacity-modeling-and-integration.md` §3.2), same
 * discriminated-union-by-phase precedent as
 * `warehouseRebuildController.ts`. Validates the Step Functions Task
 * input first, per CLAUDE.md §5.2, then delegates to the matching service
 * function — never touches a DAO directly.
 */
export const orderExecutionController = async (event: unknown): Promise<DispatchResult | Record<string, never>> => {
  logInfo("OrderExecutionControllerInvoked", { event });

  const parsed = OrderExecutionTaskSchema.safeParse(event);
  if (!parsed.success) {
    logError("OrderExecutionControllerValidationFailed", { issues: parsed.error.issues });
    throw new ValidationError("Order execution task payload failed validation", parsed.error.issues);
  }

  const task = parsed.data;
  switch (task.phase) {
    case "DISPATCH":
      return dispatchOrder(task.order_id, task.transit_minutes, task.processing_minutes);
    case "ARRIVE":
      await arriveAtJob(task.order_id, task.operator_id, task.job_location);
      return {};
    case "RESOLVE":
      await resolveOrder(task.order_id, task.operator_id);
      return {};
  }
};
