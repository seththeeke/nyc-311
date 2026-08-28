import { z } from "zod";

/*
 * Mirrors backend/models/pipelineStatus.ts exactly — a passthrough of
 * CodePipeline's own status strings (not remapped to a frontend-owned
 * enum), so a new pipeline stage/action never needs a code change here to
 * show up (2-pipeline-monitoring.md §4).
 */

export const PipelineActionSchema = z.object({
  actionName: z.string().min(1),
  status: z.string().min(1).nullable(),
  lastStatusChange: z.string().min(1).nullable(),
  summary: z.string().min(1).nullable(),
});

export type PipelineAction = z.infer<typeof PipelineActionSchema>;

export const PipelineStageSchema = z.object({
  stageName: z.string().min(1),
  actions: z.array(PipelineActionSchema),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PipelineExecutionSchema = z.object({
  executionId: z.string().min(1),
  status: z.string().min(1),
  startTime: z.string().min(1).nullable(),
  lastUpdateTime: z.string().min(1).nullable(),
  commitId: z.string().min(1).nullable(),
  commitMessage: z.string().min(1).nullable(),
  /* The Build stage's own duration for this execution — null when it hasn't completed yet or the backend lookup failed. */
  buildDurationSeconds: z.number().nonnegative().nullable(),
});

export type PipelineExecution = z.infer<typeof PipelineExecutionSchema>;

export const PipelineStatusResponseSchema = z.object({
  pipelineName: z.string().min(1),
  stages: z.array(PipelineStageSchema),
  executions: z.array(PipelineExecutionSchema),
});

export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;
