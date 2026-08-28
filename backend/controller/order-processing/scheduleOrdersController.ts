import type { Context } from "aws-lambda";
import { logInfo } from "../../logger";
import { scheduleOrders, type SchedulingRunSummary } from "../../service/scheduling/orderSchedulingService";
import { OrderSchedulingTriggerSchema } from "../../models/orderSchedulingTrigger";
import { ValidationError } from "../../models/errors";

/**
 * Order-scheduling job entry point — invoked directly by an EventBridge
 * Scheduler target, `rate(1 hour)` (6-order-scheduling.md §1). Validates
 * the trigger, delegates to `scheduleOrders`, and lets failures propagate
 * so the schedule's on-failure DLQ still catches them.
 */
export const scheduleOrdersController = async (event: unknown, context: Context): Promise<SchedulingRunSummary> => {
  logInfo("ScheduleOrdersControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = OrderSchedulingTriggerSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Order scheduling trigger payload failed validation", parsed.error.issues);
  }

  const summary = await scheduleOrders();
  logInfo("ScheduleOrdersControllerCompleted", { summary, awsRequestId: context.awsRequestId });
  return summary;
};
