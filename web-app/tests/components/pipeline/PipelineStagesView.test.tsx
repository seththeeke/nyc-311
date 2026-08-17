import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStagesView } from "../../../src/components/pipeline/PipelineStagesView";
import type { PipelineStage } from "../../../src/models/pipelineStatus";

const stages: PipelineStage[] = [
  {
    stageName: "Source",
    actions: [{ actionName: "GitHub", status: "Succeeded", lastStatusChange: null, summary: null }],
  },
  {
    stageName: "Build",
    actions: [{ actionName: "Synth", status: "InProgress", lastStatusChange: null, summary: null }],
  },
  {
    stageName: "DeployProd",
    actions: [{ actionName: "Nyc311-Prod.Deploy", status: null, lastStatusChange: null, summary: null }],
  },
];

describe("PipelineStagesView", () => {
  it("renders every stage name and its actions, with no hardcoded stage list", () => {
    render(<PipelineStagesView stages={stages} />);

    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("DeployProd")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Synth")).toBeInTheDocument();
    expect(screen.getByText("Nyc311-Prod.Deploy")).toBeInTheDocument();
  });

  it("shows the status label for each action, including a never-run action", () => {
    render(<PipelineStagesView stages={stages} />);

    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Not run yet")).toBeInTheDocument();
  });

  it("renders no leading arrow before the first stage", () => {
    render(<PipelineStagesView stages={[stages[0]]} />);

    expect(screen.queryByText("→")).not.toBeInTheDocument();
  });

  it("renders an arrow between stages", () => {
    render(<PipelineStagesView stages={stages} />);

    expect(screen.getAllByText("→")).toHaveLength(stages.length - 1);
  });
});
