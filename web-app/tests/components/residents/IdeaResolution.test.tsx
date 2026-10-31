import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IdeaResolution } from "../../../src/components/residents/IdeaResolution";
import { IdeaStepNode } from "../../../src/components/residents/IdeaStepNode";
import { ResolutionBadge } from "../../../src/components/residents/ResolutionBadge";
import { notActionedResolution, type IdeaStep } from "../../../src/models/residentIdea";
import { MOCK_IDEA_STEPS, MOCK_RESIDENT_IDEAS } from "../../../src/test-data/residentIdeas";

const byId = (id: string) => MOCK_RESIDENT_IDEAS.find((idea) => idea.idea_id === id)!;

describe("ResolutionBadge", () => {
  it("labels each state, and reads an old in-progress idea as stalled", () => {
    const { rerender } = render(<ResolutionBadge resolution={byId("01K7IDEA0007").resolution} />);
    expect(screen.getByText("Satisfied")).toHaveAttribute("data-state", "SATISFIED");
    rerender(<ResolutionBadge resolution={byId("01K7IDEA0012").resolution} now={new Date("2026-10-14T11:30:00.000Z")} />);
    expect(screen.getByText("Working on it…")).toBeInTheDocument();
    rerender(<ResolutionBadge resolution={byId("01K7IDEA0012").resolution} now={new Date("2026-10-14T13:00:00.000Z")} />);
    expect(screen.getByText("Stalled")).toBeInTheDocument();
    rerender(<ResolutionBadge resolution={notActionedResolution()} />);
    expect(screen.getByText("Not actioned")).toBeInTheDocument();
  });
});

describe("IdeaResolution", () => {
  it("shows how it ended in the resident's words, the follow-up, and every step in order", () => {
    render(<IdeaResolution idea={byId("01K7IDEA0009")} steps={MOCK_IDEA_STEPS["01K7IDEA0009"]} />);
    const section = screen.getByRole("region", { name: "Idea Resolution" });
    expect(within(section).getByText("Unsatisfied")).toBeInTheDocument();
    expect(section).toHaveTextContent("Couldn't even look it up. Asked them for a page I can check.");
    expect(section).toHaveTextContent("Will follow up: Check the Concourse grate on my way in Thursday.");
    expect(section).toHaveTextContent("3 steps");
    const workstream = screen.getByRole("list", { name: "Workstream" });
    expect(within(workstream).getAllByRole("listitem")).toHaveLength(3);
    expect(within(workstream).getByText("Searched requests")).toBeInTheDocument();
    expect(within(workstream).getByText("Filed a feature request")).toBeInTheDocument();
    expect(within(workstream).getByText("Finished")).toBeInTheDocument();
  });

  it("says nothing has happened on an unworked idea, and counts a single unfinished step", () => {
    const { rerender } = render(<IdeaResolution idea={byId("01K7IDEA0010")} steps={[]} />);
    expect(screen.getByRole("region", { name: "Idea Resolution" })).toHaveTextContent("Nothing yet.");
    rerender(<IdeaResolution idea={byId("01K7IDEA0012")} steps={MOCK_IDEA_STEPS["01K7IDEA0012"]} />);
    const section = screen.getByRole("region", { name: "Idea Resolution" });
    expect(section).toHaveTextContent("1 step");
    expect(section).not.toHaveTextContent("took");
  });

  it("leaves out the start time when there is none", () => {
    const idea = byId("01K7IDEA0007");
    render(<IdeaResolution idea={{ ...idea, resolution: { ...idea.resolution, started_at: null, summary: null } }} steps={[]} />);
    expect(screen.getByRole("region", { name: "Idea Resolution" })).not.toHaveTextContent("Started");
  });
});

describe("IdeaStepNode", () => {
  it("shows the decision in the resident's words, the result, and the exact exchange with its call id", () => {
    render(<IdeaStepNode step={MOCK_IDEA_STEPS["01K7IDEA0007"][0]} />);
    expect(screen.getByText(/Let me see if they've actually booked it\./)).toBeInTheDocument();
    expect(screen.getByText("Found it: scheduled, 16 Oct 13:00–15:00.")).toBeInTheDocument();
    expect(screen.getByText(/Completed · 420ms/)).toBeInTheDocument();
    expect(screen.getByText("Request / Response")).toBeInTheDocument();
    expect(screen.getByText("POST /v1/requests/search")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 200 · X-Call-Id 01K8CALL/)).toBeInTheDocument();
  });

  it("marks a failed call, and explains a forced finish", () => {
    const { rerender } = render(<IdeaStepNode step={MOCK_IDEA_STEPS["01K7IDEA0009"][0]} />);
    expect(screen.getByText(/Failed ·/)).toBeInTheDocument();
    rerender(<IdeaStepNode step={MOCK_IDEA_STEPS["01K7IDEA0013"][3]} />);
    expect(screen.getByText("Stopped at the limit")).toBeInTheDocument();
    expect(screen.getByText(/used up their turns/)).toBeInTheDocument();
  });

  it("shows a check that failed before any call without an exchange, and a call with no body or response", () => {
    const base = MOCK_IDEA_STEPS["01K7IDEA0007"][0];
    const checked: IdeaStep = {
      ...base,
      decision: { tool: "GET_FEATURE_REQUEST", input: {}, model_text: null },
      execution: { status: "FAILED", summary: "Not checked: no id.", request: null, response: null, error: "Not checked: no id.", started_at: "a", completed_at: "a" },
    };
    const { rerender } = render(<IdeaStepNode step={checked} />);
    expect(screen.getByText("Checked a feature request")).toBeInTheDocument();
    expect(screen.queryByText("Request / Response")).not.toBeInTheDocument();
    const bare: IdeaStep = { ...base, decision: null, kind: "TOOL_CALL", execution: { ...base.execution!, request: { method: "GET", path: "/v1/x" }, response: null } };
    rerender(<IdeaStepNode step={bare} />);
    expect(screen.getByText("GET /v1/x")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
  });
});
