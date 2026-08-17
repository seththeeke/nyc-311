import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineExecutionHistory } from "../../../src/components/pipeline/PipelineExecutionHistory";
import type { PipelineExecution } from "../../../src/models/pipelineStatus";

const succeeded: PipelineExecution = {
  executionId: "exec-1",
  status: "Succeeded",
  startTime: "2026-08-16T12:00:00.000Z",
  lastUpdateTime: "2026-08-16T12:04:00.000Z",
  commitId: "abc123",
  commitMessage: "[feat] - Claude Commit: Something",
};

const restart: PipelineExecution = {
  executionId: "exec-2",
  status: "Cancelled",
  startTime: null,
  lastUpdateTime: null,
  commitId: null,
  commitMessage: null,
};

describe("PipelineExecutionHistory", () => {
  it("renders one row per execution with its commit message", () => {
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    expect(screen.getByText("[feat] - Claude Commit: Something")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });

  it("renders a commit message even without a commitId (no title tooltip)", () => {
    render(<PipelineExecutionHistory executions={[{ ...succeeded, commitId: null }]} />);

    expect(screen.getByText("[feat] - Claude Commit: Something")).toBeInTheDocument();
  });

  it("shows a placeholder for a self-mutation restart with no commit info", () => {
    render(<PipelineExecutionHistory executions={[restart]} />);

    expect(screen.getByText("Pipeline restart (no commit)")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2); // Started + Duration, both unavailable without a startTime
  });

  it("renders a table row for every execution", () => {
    render(<PipelineExecutionHistory executions={[succeeded, restart]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 data rows
  });
});
