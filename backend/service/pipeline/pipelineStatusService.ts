import {
  CodePipelineClient,
  GetPipelineExecutionCommand,
  GetPipelineStateCommand,
  ListPipelineExecutionsCommand,
  type ActionState,
  type PipelineExecutionSummary,
  type StageState,
} from "@aws-sdk/client-codepipeline";
import { logInfo, logWarn } from "../../logger";
import type { PipelineAction, PipelineExecution, PipelineStage, PipelineStatusResponse } from "../../models/pipelineStatus";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside getPipelineStatus, not at module scope — per CLAUDE.md §5.2 (revised 2026-08-22). */
function getDefaultPipelineName(): string {
  return requireEnv("PIPELINE_NAME");
}

/*
 * 2-pipeline-monitoring.md §4 — the console's own execution-history list
 * is effectively unbounded (scrolling); this is a deliberate, small cap.
 */
const EXECUTION_HISTORY_LIMIT = 10;

export interface GetPipelineStatusDeps {
  client?: CodePipelineClient;
  pipelineName?: string;
}

/**
 * Read-only mirror of Nyc311Pipeline's AWS console status view
 * (2-pipeline-monitoring.md §3/§4) — the current per-stage/per-action
 * state, plus the most recent runs' history. Every CodePipeline call here
 * is read-only; nothing in this service can mutate the pipeline.
 */
export async function getPipelineStatus(deps: GetPipelineStatusDeps = {}): Promise<PipelineStatusResponse> {
  const client = deps.client ?? new CodePipelineClient({});
  const pipelineName = deps.pipelineName ?? getDefaultPipelineName();

  logInfo("GetPipelineStatusStarted", { pipelineName });

  const [state, executionSummaries] = await Promise.all([
    client.send(new GetPipelineStateCommand({ name: pipelineName })),
    client.send(new ListPipelineExecutionsCommand({ pipelineName, maxResults: EXECUTION_HISTORY_LIMIT })),
  ]);

  const stages = (state.stageStates ?? []).map(mapStage);

  const summaries = executionSummaries.pipelineExecutionSummaries ?? [];
  const executions = await Promise.all(
    summaries.map((summary) => mapExecution(client, pipelineName, summary))
  );

  logInfo("GetPipelineStatusCompleted", {
    pipelineName,
    stageCount: stages.length,
    executionCount: executions.length,
  });

  return { pipelineName, stages, executions };
}

function mapStage(stage: StageState): PipelineStage {
  return {
    stageName: stage.stageName ?? "",
    actions: (stage.actionStates ?? []).map(mapAction),
  };
}

function mapAction(action: ActionState): PipelineAction {
  return {
    actionName: action.actionName ?? "",
    status: action.latestExecution?.status ?? null,
    lastStatusChange: action.latestExecution?.lastStatusChange?.toISOString() ?? null,
    summary: action.latestExecution?.summary ?? null,
  };
}

async function mapExecution(
  client: CodePipelineClient,
  pipelineName: string,
  summary: PipelineExecutionSummary
): Promise<PipelineExecution> {
  const executionId = summary.pipelineExecutionId ?? "";
  const { commitId, commitMessage } = await fetchCommitInfo(client, pipelineName, executionId);

  return {
    executionId,
    status: summary.status ?? "Unknown",
    startTime: summary.startTime?.toISOString() ?? null,
    lastUpdateTime: summary.lastUpdateTime?.toISOString() ?? null,
    commitId,
    commitMessage,
  };
}

interface CommitInfo {
  commitId: string | null;
  commitMessage: string | null;
}

/**
 * ListPipelineExecutions doesn't include the commit message, only
 * GetPipelineExecution's artifactRevisions does — one extra call per
 * history row. Failure here (throttling, a malformed revisionSummary)
 * degrades to nulls for that one row rather than failing the whole
 * response — the same "an observability gap never masks the real data"
 * principle as elsewhere in this project (1-data-ingestion.md §8a).
 */
async function fetchCommitInfo(
  client: CodePipelineClient,
  pipelineName: string,
  executionId: string
): Promise<CommitInfo> {
  if (!executionId) return { commitId: null, commitMessage: null };

  try {
    const result = await client.send(
      new GetPipelineExecutionCommand({ pipelineName, pipelineExecutionId: executionId })
    );
    const revision = result.pipelineExecution?.artifactRevisions?.[0];
    if (!revision) return { commitId: null, commitMessage: null };

    return {
      commitId: revision.revisionId ?? null,
      commitMessage: parseCommitMessage(revision.revisionSummary),
    };
  } catch (err) {
    logWarn("GetPipelineExecutionFailed", {
      pipelineName,
      executionId,
      error: err instanceof Error ? err.message : err,
    });
    return { commitId: null, commitMessage: null };
  }
}

/**
 * GitHub-sourced revisions carry `{"ProviderType":"GitHub","CommitMessage":"..."}`
 * as a JSON string in revisionSummary (confirmed empirically via the AWS
 * CLI against this project's own pipeline). Any other shape — a missing
 * field, a non-JSON summary from a different provider type — degrades to
 * null rather than throwing; this is display text, not something the rest
 * of the response depends on.
 */
function parseCommitMessage(revisionSummary: string | undefined): string | null {
  if (!revisionSummary) return null;
  try {
    const parsed: unknown = JSON.parse(revisionSummary);
    if (parsed && typeof parsed === "object" && "CommitMessage" in parsed) {
      const message = (parsed as { CommitMessage?: unknown }).CommitMessage;
      return typeof message === "string" && message.length > 0 ? message : null;
    }
    return null;
  } catch {
    return null;
  }
}
