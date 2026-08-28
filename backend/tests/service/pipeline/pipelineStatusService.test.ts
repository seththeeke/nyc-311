import {
  CodePipelineClient,
  GetPipelineExecutionCommand,
  GetPipelineStateCommand,
  ListActionExecutionsCommand,
  ListPipelineExecutionsCommand,
} from "@aws-sdk/client-codepipeline";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPipelineStatus } from "../../../service/pipeline/pipelineStatusService";

const PIPELINE_NAME = "Nyc311Pipeline";
const ppMock = mockClient(CodePipelineClient);
const client = new CodePipelineClient({});

beforeEach(() => {
  ppMock.reset();
  /* Baseline default — no Synth action found, buildDurationSeconds null. Individual tests override to test the real computation. */
  ppMock.on(ListActionExecutionsCommand).resolves({ actionExecutionDetails: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPipelineStatus", () => {
  it("maps stage/action state and execution history with commit info", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({
      stageStates: [
        {
          stageName: "Build",
          actionStates: [
            {
              actionName: "Synth",
              latestExecution: {
                status: "Succeeded",
                lastStatusChange: new Date("2026-08-16T09:00:00.000Z"),
                summary: "ok",
              },
            },
          ],
        },
      ],
    });
    ppMock.on(ListPipelineExecutionsCommand).resolves({
      pipelineExecutionSummaries: [
        {
          pipelineExecutionId: "exec-1",
          status: "Succeeded",
          startTime: new Date("2026-08-16T08:00:00.000Z"),
          lastUpdateTime: new Date("2026-08-16T08:10:00.000Z"),
        },
      ],
    });
    ppMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: {
        artifactRevisions: [
          {
            revisionId: "abc123",
            revisionSummary: JSON.stringify({ ProviderType: "GitHub", CommitMessage: "fix: thing" }),
          },
        ],
      },
    });
    ppMock.on(ListActionExecutionsCommand).resolves({
      actionExecutionDetails: [
        {
          actionName: "Synth",
          startTime: new Date("2026-08-16T08:01:00.000Z"),
          lastUpdateTime: new Date("2026-08-16T08:06:18.000Z"),
        },
      ],
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result).toEqual({
      pipelineName: PIPELINE_NAME,
      stages: [
        {
          stageName: "Build",
          actions: [
            { actionName: "Synth", status: "Succeeded", lastStatusChange: "2026-08-16T09:00:00.000Z", summary: "ok" },
          ],
        },
      ],
      executions: [
        {
          executionId: "exec-1",
          status: "Succeeded",
          startTime: "2026-08-16T08:00:00.000Z",
          lastUpdateTime: "2026-08-16T08:10:00.000Z",
          commitId: "abc123",
          commitMessage: "fix: thing",
          buildDurationSeconds: 318,
        },
      ],
    });
    const executionCall = ppMock.commandCalls(GetPipelineExecutionCommand)[0].args[0].input;
    expect(executionCall).toEqual({ pipelineName: PIPELINE_NAME, pipelineExecutionId: "exec-1" });
    const actionExecutionsCall = ppMock.commandCalls(ListActionExecutionsCommand)[0].args[0].input;
    expect(actionExecutionsCall).toEqual({
      pipelineName: PIPELINE_NAME,
      filter: { pipelineExecutionId: "exec-1" },
    });
  });

  it("defaults missing/undefined fields to safe values", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({ stageStates: [{ actionStates: [{}] }] });
    ppMock.on(ListPipelineExecutionsCommand).resolves({ pipelineExecutionSummaries: [{}] });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.stages).toEqual([
      { stageName: "", actions: [{ actionName: "", status: null, lastStatusChange: null, summary: null }] },
    ]);
    expect(result.executions).toEqual([
      {
        executionId: "",
        status: "Unknown",
        startTime: null,
        lastUpdateTime: null,
        commitId: null,
        commitMessage: null,
        buildDurationSeconds: null,
      },
    ]);
  });

  it("defaults a stage's actions to an empty array when actionStates is absent", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({ stageStates: [{ stageName: "Build" }] });
    ppMock.on(ListPipelineExecutionsCommand).resolves({});

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.stages).toEqual([{ stageName: "Build", actions: [] }]);
  });

  it("returns empty stages/executions when the pipeline has neither", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock.on(ListPipelineExecutionsCommand).resolves({});

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result).toEqual({ pipelineName: PIPELINE_NAME, stages: [], executions: [] });
  });

  it("skips the commit-info and build-duration lookups for an execution with no ID", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock.on(ListPipelineExecutionsCommand).resolves({ pipelineExecutionSummaries: [{ status: "Succeeded" }] });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ executionId: "", commitId: null, commitMessage: null, buildDurationSeconds: null });
    expect(ppMock.commandCalls(GetPipelineExecutionCommand)).toHaveLength(0);
    expect(ppMock.commandCalls(ListActionExecutionsCommand)).toHaveLength(0);
  });

  it("degrades to null build duration when ListActionExecutions fails, without failing the whole response", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Failed" }] });
    ppMock.on(ListActionExecutionsCommand).rejects(new Error("throttled"));

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("returns null build duration when no Synth action appears in ListActionExecutions", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(ListActionExecutionsCommand).resolves({ actionExecutionDetails: [{ actionName: "DeployTest" }] });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("returns null build duration when actionExecutionDetails is absent entirely", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(ListActionExecutionsCommand).resolves({});

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("returns null build duration for a nonsensical negative duration (lastUpdateTime before startTime)", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(ListActionExecutionsCommand).resolves({
      actionExecutionDetails: [
        {
          actionName: "Synth",
          startTime: new Date("2026-08-16T08:10:00.000Z"),
          lastUpdateTime: new Date("2026-08-16T08:00:00.000Z"),
        },
      ],
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("returns null build duration when the Synth action has no lastUpdateTime yet (still running)", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "InProgress" }] });
    ppMock.on(ListActionExecutionsCommand).resolves({
      actionExecutionDetails: [{ actionName: "Synth", startTime: new Date("2026-08-16T08:00:00.000Z") }],
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("degrades to null commit info when GetPipelineExecution fails, without failing the whole response", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Failed" }] });
    ppMock.on(GetPipelineExecutionCommand).rejects(new Error("throttled"));

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ executionId: "exec-1", status: "Failed", commitId: null, commitMessage: null });
  });

  it("returns null commit info when the execution has no artifact revisions", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({ pipelineExecution: { artifactRevisions: [] } });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: null, commitMessage: null });
  });

  it("defaults a revision's commitId to null when revisionId is absent", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({ pipelineExecution: { artifactRevisions: [{}] } });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: null });
  });

  it("logs a genuinely non-Error rejection from GetPipelineExecution without throwing", async () => {
    /*
     * aws-sdk-client-mock's .rejects(string) wraps the string into a real
     * Error, so it can't exercise the `err instanceof Error` false branch
     * — this bypasses that wrapping to reject with a bare string directly,
     * for the (rare but real) case of a non-Error thrown by SDK middleware.
     */
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Failed" }] });
    const originalSend = client.send.bind(client) as typeof client.send;
    vi.spyOn(client, "send").mockImplementation(((command: Parameters<typeof client.send>[0]) => {
      if (command instanceof GetPipelineExecutionCommand) {
        return Promise.reject("raw string rejection");
      }
      return originalSend(command);
    }) as unknown as typeof client.send);

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: null, commitMessage: null });
  });

  it("logs a genuinely non-Error rejection from ListActionExecutions without throwing", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Failed" }] });
    const originalSend = client.send.bind(client) as typeof client.send;
    vi.spyOn(client, "send").mockImplementation(((command: Parameters<typeof client.send>[0]) => {
      if (command instanceof ListActionExecutionsCommand) {
        return Promise.reject("raw string rejection");
      }
      return originalSend(command);
    }) as unknown as typeof client.send);

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ buildDurationSeconds: null });
  });

  it("returns null commit message when the revision has no revisionSummary at all", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: { artifactRevisions: [{ revisionId: "abc" }] },
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: "abc", commitMessage: null });
  });

  it("returns null commit message for a non-JSON revisionSummary", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: { artifactRevisions: [{ revisionId: "abc", revisionSummary: "not json" }] },
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: "abc", commitMessage: null });
  });

  it("returns null commit message when revisionSummary JSON has no CommitMessage field", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: {
        artifactRevisions: [{ revisionId: "abc", revisionSummary: JSON.stringify({ ProviderType: "S3" }) }],
      },
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: "abc", commitMessage: null });
  });

  it("returns null commit message when CommitMessage is present but not a usable string", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock
      .on(ListPipelineExecutionsCommand)
      .resolves({ pipelineExecutionSummaries: [{ pipelineExecutionId: "exec-1", status: "Succeeded" }] });
    ppMock.on(GetPipelineExecutionCommand).resolves({
      pipelineExecution: {
        artifactRevisions: [
          { revisionId: "abc", revisionSummary: JSON.stringify({ ProviderType: "GitHub", CommitMessage: "" }) },
        ],
      },
    });

    const result = await getPipelineStatus({ client, pipelineName: PIPELINE_NAME });

    expect(result.executions[0]).toMatchObject({ commitId: "abc", commitMessage: null });
  });

  it("defaults to the module's own client/pipeline name when not injected", async () => {
    ppMock.on(GetPipelineStateCommand).resolves({});
    ppMock.on(ListPipelineExecutionsCommand).resolves({});

    await expect(getPipelineStatus()).resolves.toMatchObject({ pipelineName: PIPELINE_NAME });
  });
});

describe("module wiring", () => {
  it("does not throw on import when PIPELINE_NAME is unset (lazy construction, CLAUDE.md §5.2)", async () => {
    const previous = process.env.PIPELINE_NAME;
    delete process.env.PIPELINE_NAME;
    vi.resetModules();

    await expect(import("../../../service/pipeline/pipelineStatusService.js")).resolves.toBeDefined();

    process.env.PIPELINE_NAME = previous;
    vi.resetModules();
  });

  it("throws only when getPipelineStatus is actually called without deps.pipelineName and the env var is unset", async () => {
    const previous = process.env.PIPELINE_NAME;
    delete process.env.PIPELINE_NAME;
    vi.resetModules();
    const { getPipelineStatus: freshGetPipelineStatus } = await import(
      "../../../service/pipeline/pipelineStatusService.js"
    );

    await expect(freshGetPipelineStatus()).rejects.toThrow("Missing required environment variable: PIPELINE_NAME");

    process.env.PIPELINE_NAME = previous;
    vi.resetModules();
  });
});
