import { z } from "zod";
import { GpsLocationSchema } from "./gpsLocation";

/*
 * The order-execution simulation's Step Function Task input
 * (10-capacity-modeling-and-integration.md §3.2) — one phase-routed
 * Lambda, `Nyc311OrderExecutionLambda`, same discriminated-union-by-phase
 * pattern as models/warehouseRebuild.ts's WarehouseRebuildTaskSchema (the
 * one other state-machine precedent in this codebase).
 */

/**
 * Started by orderSchedulingService right after claiming an idle Operator —
 * computes and returns the scaled Wait durations for the two Wait states
 * that follow. Carries no timing estimate of its own — both transit and
 * processing are re-estimated live at dispatch time
 * (`transitTimeService.ts`/`processingTimeService.ts`), not carried over
 * from the scheduling-time estimates.
 */
export const DispatchTaskSchema = z.object({
  phase: z.literal("DISPATCH"),
  order_id: z.string().min(1),
  operator_id: z.string().min(1),
  job_location: GpsLocationSchema,
});
export type DispatchTask = z.infer<typeof DispatchTaskSchema>;

export const DispatchResultSchema = z.object({
  transit_wait_seconds: z.number().nonnegative(),
  processing_wait_seconds: z.number().nonnegative(),
  /* Drawn at dispatch, carried by the state machine to Resolve (v1-prod-deployment.md Q5). */
  materials_cost_actual: z.number().nonnegative(),
});
export type DispatchResult = z.infer<typeof DispatchResultSchema>;

/** Fired after the transit Wait — vehicle reached the job location. */
export const ArriveTaskSchema = z.object({
  phase: z.literal("ARRIVE"),
  order_id: z.string().min(1),
  operator_id: z.string().min(1),
  job_location: GpsLocationSchema,
});
export type ArriveTask = z.infer<typeof ArriveTaskSchema>;

/** Fired after the processing Wait — on-site work finished. */
export const ResolveTaskSchema = z.object({
  phase: z.literal("RESOLVE"),
  order_id: z.string().min(1),
  operator_id: z.string().min(1),
  /* From `$.dispatch`. Null for an execution dispatched before materials cost existed. */
  materials_cost_actual: z.number().nonnegative().nullable().default(null),
});
export type ResolveTask = z.infer<typeof ResolveTaskSchema>;

/**
 * The Catch path after any step fails (v1-prod-deployment.md Q3/F6) —
 * `error` is the Step Functions error name from `$.executionError.Error`.
 */
export const FailTaskSchema = z.object({
  phase: z.literal("FAIL"),
  order_id: z.string().min(1),
  operator_id: z.string().min(1),
  error: z.string().min(1),
});
export type FailTask = z.infer<typeof FailTaskSchema>;

export const OrderExecutionTaskSchema = z.discriminatedUnion("phase", [
  DispatchTaskSchema,
  ArriveTaskSchema,
  ResolveTaskSchema,
  FailTaskSchema,
]);
export type OrderExecutionTask = z.infer<typeof OrderExecutionTaskSchema>;
