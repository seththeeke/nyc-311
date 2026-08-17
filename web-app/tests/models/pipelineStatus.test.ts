import { describe, expect, it } from "vitest";
import { PipelineExecutionSchema, PipelineStatusResponseSchema } from "../../src/models/pipelineStatus";

const validExecution = {
  executionId: "5d2d2f52-a1b0-4c7a-962b-89ae14cc1ee8",
  status: "Succeeded",
  startTime: "2026-08-16T09:30:00.000Z",
  lastUpdateTime: "2026-08-16T09:40:00.000Z",
  commitId: "2aa6ea88a2fc2fad6089e5e12c8317f0df2c4a4a",
  commitMessage: "[feat] - Claude Commit: Redesign the ingestion-metrics dashboard",
};

describe("PipelineExecutionSchema", () => {
  it("accepts a well-formed execution", () => {
    expect(PipelineExecutionSchema.parse(validExecution)).toEqual(validExecution);
  });

  it("accepts a self-mutation-triggered execution with no commit info", () => {
    const restarted = { ...validExecution, commitId: null, commitMessage: null };
    expect(PipelineExecutionSchema.parse(restarted)).toEqual(restarted);
  });

  it("rejects a missing status", () => {
    const withoutStatus: Record<string, unknown> = { ...validExecution };
    delete withoutStatus.status;
    expect(PipelineExecutionSchema.safeParse(withoutStatus).success).toBe(false);
  });
});

describe("PipelineStatusResponseSchema", () => {
  it("accepts a well-formed response", () => {
    const response = {
      pipelineName: "Nyc311Pipeline",
      stages: [{ stageName: "Build", actions: [{ actionName: "Synth", status: "Succeeded", lastStatusChange: null, summary: null }] }],
      executions: [validExecution],
    };
    expect(PipelineStatusResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a response with no execution history yet", () => {
    const response = { pipelineName: "Nyc311Pipeline", stages: [], executions: [] };
    expect(PipelineStatusResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a response missing pipelineName", () => {
    expect(
      PipelineStatusResponseSchema.safeParse({ stages: [], executions: [] }).success
    ).toBe(false);
  });
});
