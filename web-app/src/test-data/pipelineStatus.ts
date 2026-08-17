import type { PipelineStatusResponse } from "../models/pipelineStatus";

// Baked sample data for "mock" data mode (config.ts) — mirrors this
// project's own real pipeline shape (Source -> Build -> UpdatePipeline ->
// DeployTest -> DeployProd) with a mix of statuses, including the
// self-mutation-restart pattern (a Cancelled execution followed by a
// StartPipelineExecution-triggered restart with no commit info) that's a
// real, recurring shape in this pipeline's actual history.
export const MOCK_PIPELINE_STATUS: PipelineStatusResponse = {
  pipelineName: "Nyc311Pipeline",
  stages: [
    {
      stageName: "Source",
      actions: [
        {
          actionName: "seththeeke_nyc_311_Source",
          status: "Succeeded",
          lastStatusChange: "2026-08-16T19:15:00.000Z",
          summary: null,
        },
      ],
    },
    {
      stageName: "Build",
      actions: [
        {
          actionName: "Synth",
          status: "Succeeded",
          lastStatusChange: "2026-08-16T19:19:00.000Z",
          summary: null,
        },
      ],
    },
    {
      stageName: "UpdatePipeline",
      actions: [
        {
          actionName: "SelfMutate",
          status: "Succeeded",
          lastStatusChange: "2026-08-16T19:21:00.000Z",
          summary: null,
        },
      ],
    },
    {
      stageName: "DeployTest",
      actions: [
        {
          actionName: "Nyc311-Test.Deploy",
          status: "InProgress",
          lastStatusChange: "2026-08-16T19:22:00.000Z",
          summary: null,
        },
      ],
    },
    {
      stageName: "DeployProd",
      actions: [
        {
          actionName: "ProdDiff",
          status: null,
          lastStatusChange: null,
          summary: null,
        },
        {
          actionName: "Nyc311-Prod.Deploy",
          status: null,
          lastStatusChange: null,
          summary: null,
        },
      ],
    },
  ],
  executions: [
    {
      executionId: "a531f8c3-d2ce-4739-b517-209aeb03f53b",
      status: "InProgress",
      startTime: "2026-08-16T19:15:00.000Z",
      lastUpdateTime: "2026-08-16T19:22:00.000Z",
      commitId: "07a79163610494be42b345cabb8335915edea37b",
      commitMessage: "[feat] - Claude Commit: Add the pipeline-status API (backend + cdk)",
    },
    {
      executionId: "66a3d57c-8acd-4da1-822c-8fd81f828590",
      status: "Succeeded",
      startTime: "2026-08-16T18:40:00.000Z",
      lastUpdateTime: "2026-08-16T18:55:00.000Z",
      commitId: "c01cced891fe8e47672737e5085f0a58b9b8baa2",
      commitMessage: "[feat] - Claude Commit: Log two deferred items in 99-things-to-come-back-to.md",
    },
    {
      executionId: "d6a06148-7533-480c-849f-2f4f11945712",
      status: "Cancelled",
      startTime: "2026-08-15T14:51:21.000Z",
      lastUpdateTime: "2026-08-15T14:57:24.000Z",
      commitId: "f89ca47eec29c6e8a3967d112d4b7c48e79accec",
      commitMessage: "[feat] - Claude Commit: Record poller-metrics rows on every run, success or failure",
    },
  ],
};
