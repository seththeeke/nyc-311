import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { logInfo } from "../../logger";
import type { GpsLocation } from "../../models/gpsLocation";

/*
 * Pluggable interface, same "swappable dep for testability" precedent as
 * every other scheduling dependency in this file's neighborhood
 * (10-capacity-modeling-and-integration.md §3.2/§3.8) — one execution per
 * Order, started right after the scheduling job claims an idle Operator.
 */
export interface StartOrderExecutionInput {
  orderId: string;
  operatorId: string;
  /** The job's GPS position — already resolved (Location's lat/lng, or HOME_DEPOT_LOCATION as a fallback) by the caller. */
  jobLocation: GpsLocation;
  transitMinutes: number;
  processingMinutes: number;
  /** Always `now` today — the state machine's leading `Wait` state resolves instantly. A later pre-scheduling flow just passes a future timestamp (§3.8). */
  scheduledStartDatetime: string;
}

export interface OrderExecutionStarter {
  startExecution(input: StartOrderExecutionInput): Promise<void>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Real implementation — `StartExecution` against
 * `Nyc311OrderExecutionStateMachine` (§3.2). `name: orderId` gives one
 * execution per Order (a duplicate `StartExecution` for the same Order —
 * shouldn't happen, since `orderDao.scheduleOrder` already moved the Order
 * out of `SCHEDULE` — fails loudly via Step Functions'
 * `ExecutionAlreadyExists` rather than silently starting a second one).
 */
export const stepFunctionsOrderExecutionStarter: OrderExecutionStarter = {
  async startExecution(input: StartOrderExecutionInput): Promise<void> {
    const client = new SFNClient({});
    const stateMachineArn = requireEnv("ORDER_EXECUTION_STATE_MACHINE_ARN");

    logInfo("OrderExecutionStarting", { orderId: input.orderId, operatorId: input.operatorId });
    await client.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: input.orderId,
        input: JSON.stringify({
          order_id: input.orderId,
          operator_id: input.operatorId,
          job_location: input.jobLocation,
          transit_minutes: input.transitMinutes,
          processing_minutes: input.processingMinutes,
          scheduled_start_datetime: input.scheduledStartDatetime,
        }),
      })
    );
  },
};
