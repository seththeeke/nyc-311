import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineBuildDurationChart } from "../../../src/components/pipeline/PipelineBuildDurationChart";
import type { PipelineExecution } from "../../../src/models/pipelineStatus";

function makeExecution(overrides: Partial<PipelineExecution> = {}): PipelineExecution {
  return {
    executionId: "exec-1",
    status: "Succeeded",
    startTime: "2026-08-16T12:00:00.000Z",
    lastUpdateTime: "2026-08-16T12:04:00.000Z",
    commitId: "abc123",
    commitMessage: "[feat] - Claude Commit: Something",
    buildDurationSeconds: 240,
    ...overrides,
  };
}

describe("PipelineBuildDurationChart", () => {
  it("renders one accessible bar per completed build with a descriptive label", () => {
    render(<PipelineBuildDurationChart executions={[makeExecution({ buildDurationSeconds: 318 })]} />);

    expect(screen.getByText("Last 1 completed builds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build took 5m 18s/ })).toBeInTheDocument();
  });

  it("excludes an execution whose build hasn't completed yet (null buildDurationSeconds)", () => {
    const inProgress = makeExecution({ executionId: "exec-2", buildDurationSeconds: null });
    render(<PipelineBuildDurationChart executions={[inProgress]} />);

    expect(screen.getByText("No completed builds in the current history yet.")).toBeInTheDocument();
  });

  it("excludes an execution with no startTime, even if buildDurationSeconds is set", () => {
    const noStart = makeExecution({ executionId: "exec-3", startTime: null });
    render(<PipelineBuildDurationChart executions={[noStart]} />);

    expect(screen.getByText("No completed builds in the current history yet.")).toBeInTheDocument();
  });

  it("shows a no-data message when there are no executions at all", () => {
    render(<PipelineBuildDurationChart executions={[]} />);

    expect(screen.getByText("No completed builds in the current history yet.")).toBeInTheDocument();
  });

  it("truncates a multi-line commit message to its subject line in the tooltip", () => {
    const multiLine = makeExecution({ commitMessage: "[feat] - Claude Commit: Subject line\n\nA longer body." });
    render(<PipelineBuildDurationChart executions={[multiLine]} />);

    expect(screen.getByText("[feat] - Claude Commit: Subject line")).toBeInTheDocument();
    expect(screen.queryByText(/A longer body\./)).not.toBeInTheDocument();
  });

  it("falls back to the restart label in the tooltip when an execution has no commit message", () => {
    render(<PipelineBuildDurationChart executions={[makeExecution({ commitMessage: null })]} />);

    expect(screen.getByText("Pipeline restart (no commit)")).toBeInTheDocument();
  });

  it("orders bars oldest-first, reversing the API's newest-first execution list", () => {
    const older = makeExecution({
      executionId: "exec-older",
      startTime: "2026-08-15T12:00:00.000Z",
      buildDurationSeconds: 100,
    });
    const newer = makeExecution({
      executionId: "exec-newer",
      startTime: "2026-08-16T12:00:00.000Z",
      buildDurationSeconds: 200,
    });
    /* API order: newest first. */
    render(<PipelineBuildDurationChart executions={[newer, older]} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(/build took 1m 40s/);
    expect(buttons[1]).toHaveAccessibleName(/build took 3m 20s/);
  });
});
