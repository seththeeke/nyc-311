import { z } from "zod";

/*
 * Mirrors backend/models/lambdaMetrics.ts — one entry per monitored
 * Lambda (backend/service/monitoring/lambdaMetricsService.ts's static
 * MONITORED_LAMBDAS list), each with a 7-day, daily-bucketed series of
 * invocation/success/error counts. Every service response is parsed
 * through this schema before it reaches a component (CLAUDE.md §5.1).
 */

export const LambdaHealthPointSchema = z.object({
  date: z.string().min(1),
  invocations: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  successes: z.number().int(),
});
export type LambdaHealthPoint = z.infer<typeof LambdaHealthPointSchema>;

export const LambdaHealthSchema = z.object({
  logicalName: z.string().min(1),
  functionName: z.string().min(1),
  points: z.array(LambdaHealthPointSchema),
});
export type LambdaHealth = z.infer<typeof LambdaHealthSchema>;

export const LambdaMetricsResponseSchema = z.object({
  lambdas: z.array(LambdaHealthSchema),
});
export type LambdaMetricsResponse = z.infer<typeof LambdaMetricsResponseSchema>;
