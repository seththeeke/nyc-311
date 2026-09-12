import { z } from "zod";
import { GpsLocationSchema } from "./gpsLocation";

/*
 * The order-execution simulation's Step Function Task input
 * (10-capacity-modeling-and-integration.md §3.2) — one phase-routed
 * Lambda, `Nyc311OrderExecutionLambda`, same discriminated-union-by-phase
 * pattern as models/warehouseRebuild.ts's WarehouseRebuildTaskSchema (the
 * one other state-machine precedent in this codebase).
 */

/** Started by orderSchedulingService right after claiming an idle Operator — computes and returns the scaled Wait durations for the two Wait states that follow. */
export const DispatchTaskSchema = z.object({
  phase: z.literal("DISPATCH"),
  order_id: z.string().min(1),
  operator_id: z.string().min(1),
  job_location: GpsLocationSchema,
  transit_minutes: z.number().positive(),
  processing_minutes: z.number().positive(),
});
export type DispatchTask = z.infer<typeof DispatchTaskSchema>;

export const DispatchResultSchema = z.object({
  transit_wait_seconds: z.number().nonnegative(),
  processing_wait_seconds: z.number().nonnegative(),
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
});
export type ResolveTask = z.infer<typeof ResolveTaskSchema>;

export const OrderExecutionTaskSchema = z.discriminatedUnion("phase", [
  DispatchTaskSchema,
  ArriveTaskSchema,
  ResolveTaskSchema,
]);
export type OrderExecutionTask = z.infer<typeof OrderExecutionTaskSchema>;
