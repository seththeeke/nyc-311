import { z } from "zod";

/*
 * Read-only mirror of Nyc311Pipeline's AWS console status view —
 * 2-pipeline-monitoring.md §4. Deliberately a passthrough of CodePipeline's
 * own status strings (not remapped to this project's own enum) so a new
 * pipeline stage/status value never needs a code change here to show up —
 * see §4's "no hardcoded stage/action names" rule.
 */

export const PipelineActionSchema = z.object({
  actionName: z.string().min(1),
  /* null: the action has never run yet (e.g. a from-scratch pipeline). */
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
  /*
   * null for a StartPipelineExecution-triggered run (a self-mutation
   * restart, not a push) — see 1-data-ingestion.md's session notes on the
   * self-mutation-restart pattern for what that looks like in practice.
   */
  commitId: z.string().min(1).nullable(),
  commitMessage: z.string().min(1).nullable(),
  /*
   * The Build stage's Synth action's own duration for this execution —
   * added 2026-08-28 to track whether a CodeBuild compute-type change
   * (pipeline/Nyc311PipelineStack.ts) actually improves build time. Null
   * when the action hasn't completed yet, or the lookup itself fails —
   * same degrade-to-null precedent as commitId/commitMessage.
   */
  buildDurationSeconds: z.number().nonnegative().nullable(),
});

export type PipelineExecution = z.infer<typeof PipelineExecutionSchema>;

export const PipelineStatusResponseSchema = z.object({
  pipelineName: z.string().min(1),
  stages: z.array(PipelineStageSchema),
  executions: z.array(PipelineExecutionSchema),
});

export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;
