import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("keeps the status label for screen readers only — the icon carries it visually, not duplicate text", () => {
    render(<PipelineStagesView stages={stages} />);

    expect(screen.getByText("Succeeded")).toHaveClass("sr-only");
    expect(screen.getByText("In progress")).toHaveClass("sr-only");
    expect(screen.getByText("Not run yet")).toHaveClass("sr-only");
  });

  it("truncates a long action name and exposes the full name via a title tooltip", () => {
    const longName =
      "Nyc311PipelineStack_DeployTest_Nyc311Stack_Custom_S3AutoDeleteObjectsCustomResourceProvider_Code";
    render(
      <PipelineStagesView
        stages={[{ stageName: "Assets", actions: [{ actionName: longName, status: "Succeeded", lastStatusChange: null, summary: null }] }]}
      />
    );

    const nameEl = screen.getByText(longName);
    expect(nameEl).toHaveClass("truncate");
    expect(nameEl).toHaveAttribute("title", longName);
  });

  it("defaults to a horizontal layout, with no leading arrow before the first stage", () => {
    render(<PipelineStagesView stages={stages} />);
    const list = within(screen.getByTestId("stage-layout-list"));

    expect(screen.getByRole("button", { name: "Horizontal" })).toHaveAttribute("aria-pressed", "true");
    expect(list.queryByText("↓")).not.toBeInTheDocument();
    expect(list.getAllByText("→")).toHaveLength(stages.length - 1);
  });

  it("switches to a vertical layout when the toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<PipelineStagesView stages={stages} />);

    await user.click(screen.getByRole("button", { name: "Vertical" }));
    const list = within(screen.getByTestId("stage-layout-list"));

    expect(screen.getByRole("button", { name: "Vertical" })).toHaveAttribute("aria-pressed", "true");
    expect(list.queryByText("→")).not.toBeInTheDocument();
    expect(list.getAllByText("↓")).toHaveLength(stages.length - 1);
    // Stage content is unaffected by the layout switch.
    expect(screen.getByText("DeployProd")).toBeInTheDocument();
  });

  it("switches back to horizontal from vertical", async () => {
    const user = userEvent.setup();
    render(<PipelineStagesView stages={stages} />);

    await user.click(screen.getByRole("button", { name: "Vertical" }));
    await user.click(screen.getByRole("button", { name: "Horizontal" }));
    const list = within(screen.getByTestId("stage-layout-list"));

    expect(list.getAllByText("→")).toHaveLength(stages.length - 1);
    expect(list.queryByText("↓")).not.toBeInTheDocument();
  });

  it("renders no arrow at all in the stage list for a single stage, in either layout", async () => {
    const user = userEvent.setup();
    render(<PipelineStagesView stages={[stages[0]]} />);
    const list = within(screen.getByTestId("stage-layout-list"));

    expect(list.queryByText("→")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vertical" }));
    expect(list.queryByText("↓")).not.toBeInTheDocument();
  });

  it("shows the icon-only at-a-glance summary pill above the stage list", () => {
    render(<PipelineStagesView stages={stages} />);

    // The summary pill's own sr-only text — proof it's rendered here, not just the detailed list.
    expect(screen.getByText(/Source: Succeeded/)).toBeInTheDocument();
  });
});
