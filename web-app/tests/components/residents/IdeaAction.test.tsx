import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IdeaActionDetail } from "../../../src/components/residents/IdeaActionDetail";
import { IdeaActionTag } from "../../../src/components/residents/IdeaActionTag";
import type { IdeaAction } from "../../../src/models/residentIdea";
import { MOCK_RESIDENT_IDEAS } from "../../../src/test-data/residentIdeas";

const actions = MOCK_RESIDENT_IDEAS.flatMap((idea) => idea.actions);
const ofType = <T extends IdeaAction["type"]>(type: T, status = "COMPLETED") =>
  actions.find((action) => action.type === type && action.status === status) as Extract<IdeaAction, { type: T }>;

describe("IdeaActionTag", () => {
  it("names the action, marks a failure, and says when nothing was done", () => {
    const { rerender } = render(<IdeaActionTag action={ofType("BROWSE_WEBSITE")} />);
    expect(screen.getByText("Browsed the website")).toBeInTheDocument();
    rerender(<IdeaActionTag action={ofType("CHECK_STATUS_API", "FAILED")} />);
    expect(screen.getByText("Checked status via API · failed")).toBeInTheDocument();
    rerender(<IdeaActionTag action={null} />);
    expect(screen.getByText("Not actioned yet")).toBeInTheDocument();
  });
});

describe("IdeaActionDetail", () => {
  it("explains that ideas are not acted on yet, and what comes first", () => {
    render(<IdeaActionDetail actions={[]} />);
    expect(screen.getByRole("region", { name: "What they did" })).toHaveTextContent(/requesting a feature will be the first thing residents can do/);
  });

  it("shows a feature request with its intake reference, or that intake hasn't accepted it", () => {
    const request = ofType("REQUEST_FEATURE");
    const { rerender } = render(<IdeaActionDetail actions={[request]} />);
    const section = screen.getByRole("region", { name: "What they did" });
    expect(within(section).getByText("Requested a feature")).toBeInTheDocument();
    expect(within(section).getByText(request.feature_request.title)).toBeInTheDocument();
    expect(within(section).getAllByText(/FR-000\d/).length).toBeGreaterThan(0);
    rerender(<IdeaActionDetail actions={[{ ...request, outcome: null, feature_request: { ...request.feature_request, reference_id: null } }]} />);
    expect(screen.getByText("Not yet accepted by intake")).toBeInTheDocument();
  });

  it("shows an API check's request and response, and says when it didn't work", () => {
    const { rerender } = render(<IdeaActionDetail actions={[ofType("CHECK_STATUS_API")]} />);
    expect(screen.getByText(/GET https:\/\/api\.boroughsim\.com\/orders\/01K7A1ATLANTIC000000000000\/status/)).toBeInTheDocument();
    expect(screen.getByText("HTTP 200")).toBeInTheDocument();
    expect(screen.getByText(/"scheduled": false/)).toBeInTheDocument();
    rerender(<IdeaActionDetail actions={[ofType("CHECK_STATUS_API", "FAILED")]} />);
    expect(screen.getByText("HTTP 404")).toBeInTheDocument();
    expect(screen.getByText(/it didn't work/)).toBeInTheDocument();
  });

  it("lists several actions on one idea in the order they were taken", () => {
    const juniper = MOCK_RESIDENT_IDEAS.find((idea) => idea.actions.length > 1)!;
    render(<IdeaActionDetail actions={juniper.actions} />);
    const steps = within(screen.getByRole("list", { name: "Actions taken" })).getAllByRole("listitem");
    expect(steps.filter((step) => step.parentElement?.getAttribute("aria-label") === "Actions taken")).toHaveLength(2);
    expect(steps[0]).toHaveTextContent("Checked status via API");
    expect(screen.getByText("A status page I can check myself")).toBeInTheDocument();
  });

  it("shows a website visit as its recording", () => {
    render(<IdeaActionDetail actions={[ofType("BROWSE_WEBSITE")]} />);
    expect(screen.getByRole("list", { name: "Recording steps" })).toBeInTheDocument();
    expect(screen.getByText(/found 41st Avenue on the map/)).toBeInTheDocument();
  });
});
