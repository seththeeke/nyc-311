import { describe, expect, it } from "vitest";
import {
  PipelineActionSchema,
  PipelineExecutionSchema,
  PipelineStageSchema,
  PipelineStatusResponseSchema,
} from "../../models/pipelineStatus";

const validAction = {
  actionName: "Synth",
  status: "Succeeded",
  lastStatusChange: "2026-08-16T09:33:40.025Z",
  summary: null,
};

const validExecution = {
  executionId: "5d2d2f52-a1b0-4c7a-962b-89ae14cc1ee8",
  status: "Succeeded",
  startTime: "2026-08-16T09:30:00.000Z",
  lastUpdateTime: "2026-08-16T09:40:00.000Z",
  commitId: "2aa6ea88a2fc2fad6089e5e12c8317f0df2c4a4a",
  commitMessage: "[feat] - Claude Commit: Redesign the ingestion-metrics dashboard",
};

describe("PipelineActionSchema", () => {
  it("accepts a well-formed action", () => {
    expect(PipelineActionSchema.parse(validAction)).toEqual(validAction);
  });

  it("accepts a never-run action (all nullable fields null)", () => {
    const neverRun = { actionName: "DeployProd", status: null, lastStatusChange: null, summary: null };
    expect(PipelineActionSchema.parse(neverRun)).toEqual(neverRun);
  });

  it("rejects a missing actionName", () => {
    const withoutName: Record<string, unknown> = { ...validAction };
    delete withoutName.actionName;
    expect(PipelineActionSchema.safeParse(withoutName).success).toBe(false);
  });
});

describe("PipelineStageSchema", () => {
  it("accepts a stage with a list of actions", () => {
    const stage = { stageName: "Build", actions: [validAction] };
    expect(PipelineStageSchema.parse(stage)).toEqual(stage);
  });

  it("accepts a stage with no actions", () => {
    const stage = { stageName: "Build", actions: [] };
    expect(PipelineStageSchema.parse(stage)).toEqual(stage);
  });
});

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
      stages: [{ stageName: "Build", actions: [validAction] }],
      executions: [validExecution],
    };
    expect(PipelineStatusResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a response with no execution history yet", () => {
    const response = { pipelineName: "Nyc311Pipeline", stages: [], executions: [] };
    expect(PipelineStatusResponseSchema.parse(response)).toEqual(response);
  });
});
