import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStageSummary } from "../../../src/components/pipeline/PipelineStageSummary";
import type { PipelineStage } from "../../../src/models/pipelineStatus";

function action(status: string | null) {
  return { actionName: "Action", status, lastStatusChange: null, summary: null };
}

describe("PipelineStageSummary", () => {
  it("renders as a rounded pill with one icon per stage — no visible stage name text", () => {
    const stages: PipelineStage[] = [
      { stageName: "Source", actions: [action("Succeeded")] },
      { stageName: "Build", actions: [action("Succeeded")] },
    ];
    render(<PipelineStageSummary stages={stages} />);

    const pill = screen.getByRole("list");
    expect(pill).toHaveClass("rounded-full");
    /* No visible "Source"/"Build" text anywhere in the pill — only icons. */
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
    expect(screen.queryByText("Build")).not.toBeInTheDocument();
    /* The stage names are still exposed to screen readers. */
    expect(screen.getByText(/Source: Succeeded/)).toHaveClass("sr-only");
    expect(screen.getByText(/Build: Succeeded/)).toHaveClass("sr-only");
  });

  it("renders one entry per stage, in order, with no arrow before the first", () => {
    const stages: PipelineStage[] = [
      { stageName: "Source", actions: [action("Succeeded")] },
      { stageName: "Build", actions: [action("Succeeded")] },
    ];
    render(<PipelineStageSummary stages={stages} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("→")).toHaveLength(1);
  });

  it("renders no arrow at all for a single stage", () => {
    render(<PipelineStageSummary stages={[{ stageName: "Source", actions: [action("Succeeded")] }]} />);

    expect(screen.queryByText("→")).not.toBeInTheDocument();
  });

  it("rolls a stage up as failed if any action in it failed, even alongside succeeded actions", () => {
    const stages: PipelineStage[] = [
      { stageName: "Assets", actions: [action("Succeeded"), action("Failed")] },
    ];
    const { container } = render(<PipelineStageSummary stages={stages} />);

    /* Failure renders as the exclamation glyph: a path + a circle dot. */
    expect(container.querySelector("circle")).toBeInTheDocument();
    expect(screen.getByText(/Assets: Failed/)).toBeInTheDocument();
  });

  it("rolls a stage up as in-progress if nothing failed but something is still running", () => {
    const stages: PipelineStage[] = [
      { stageName: "Build", actions: [action("Succeeded"), action("InProgress")] },
    ];
    const { container } = render(<PipelineStageSummary stages={stages} />);

    expect(container.querySelector("svg")).toHaveClass("animate-spin");
    expect(screen.getByText(/Build: In progress/)).toBeInTheDocument();
  });

  it("rolls a stage up as succeeded only when every action succeeded", () => {
    const stages: PipelineStage[] = [{ stageName: "Source", actions: [action("Succeeded")] }];
    const { container } = render(<PipelineStageSummary stages={stages} />);

    expect(container.querySelector("circle")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toHaveClass("animate-spin");
    expect(screen.getByText(/Source: Succeeded/)).toBeInTheDocument();
  });

  it("rolls a stage up as neutral for a mixed terminal state (e.g. Cancelled) with no failure or in-progress action", () => {
    const stages: PipelineStage[] = [
      { stageName: "DeployProd", actions: [action("Succeeded"), action("Cancelled")] },
    ];
    render(<PipelineStageSummary stages={stages} />);

    expect(screen.getByText(/DeployProd: Not run yet/)).toBeInTheDocument();
  });

  it("rolls a stage with no actions at all up as neutral", () => {
    const stages: PipelineStage[] = [{ stageName: "Empty", actions: [] }];
    render(<PipelineStageSummary stages={stages} />);

    expect(screen.getByText(/Empty: Not run yet/)).toBeInTheDocument();
  });
});
