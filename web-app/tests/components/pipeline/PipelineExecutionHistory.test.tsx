import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipelineExecutionHistory } from "../../../src/components/pipeline/PipelineExecutionHistory";
import type { PipelineExecution } from "../../../src/models/pipelineStatus";

const succeeded: PipelineExecution = {
  executionId: "exec-1",
  status: "Succeeded",
  startTime: "2026-08-16T12:00:00.000Z",
  lastUpdateTime: "2026-08-16T12:04:00.000Z",
  commitId: "abc123",
  commitMessage: "[feat] - Claude Commit: Something\n\nA longer body explaining the change.",
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
  it("renders one condensed row per execution, showing only the commit's subject line", () => {
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    expect(screen.getByText("[feat] - Claude Commit: Something")).toBeInTheDocument();
    expect(screen.queryByText(/A longer body explaining the change\./)).not.toBeInTheDocument();
  });

  it("keeps the status label for screen readers and a hover tooltip, not visibly duplicated next to the icon", () => {
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    expect(screen.getByText("Succeeded")).toHaveClass("sr-only");
    expect(screen.getByText("Succeeded").parentElement).toHaveAttribute("title", "Succeeded");
  });

  it("does not show detail-only fields (commit ID, execution ID, absolute times) until expanded", () => {
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    expect(screen.queryByText("abc123")).not.toBeInTheDocument();
    expect(screen.queryByText("exec-1")).not.toBeInTheDocument();
  });

  it("expands a row to reveal full commit message, commit ID, execution ID, and absolute times", async () => {
    const user = userEvent.setup();
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    const toggle = screen.getByRole("button", { name: "Show execution details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Hide execution details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/A longer body explaining the change\./)).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByText("exec-1")).toBeInTheDocument();
  });

  it("collapses an expanded row when toggled again", async () => {
    const user = userEvent.setup();
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    await user.click(screen.getByRole("button", { name: "Show execution details" }));
    await user.click(screen.getByRole("button", { name: "Hide execution details" }));

    expect(screen.queryByText("abc123")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show execution details" })).toHaveAttribute("aria-expanded", "false");
  });

  it("expands each row independently", async () => {
    const user = userEvent.setup();
    render(<PipelineExecutionHistory executions={[succeeded, restart]} />);

    const toggles = screen.getAllByRole("button", { name: "Show execution details" });
    await user.click(toggles[0]);

    expect(screen.getByRole("button", { name: "Hide execution details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show execution details" })).toBeInTheDocument();
  });

  it("shows a placeholder for a self-mutation restart with no commit info, condensed and expanded", async () => {
    const user = userEvent.setup();
    render(<PipelineExecutionHistory executions={[restart]} />);

    expect(screen.getByText("Pipeline restart (no commit)")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2); // Started + Duration, both unavailable without a startTime

    await user.click(screen.getByRole("button", { name: "Show execution details" }));

    // Two placeholders now: the commit-message detail field and the commit-ID field.
    expect(screen.getAllByText("Pipeline restart (no commit)")).toHaveLength(2);
  });

  it("renders a table row for every execution", () => {
    render(<PipelineExecutionHistory executions={[succeeded, restart]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 condensed data rows
  });

  it("renders the list inside a bounded, independently-scrolling container", () => {
    render(<PipelineExecutionHistory executions={[succeeded]} />);

    expect(screen.getByTestId("execution-history-scroll")).toHaveClass("overflow-y-auto");
  });
});
