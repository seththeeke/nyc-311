import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IdeaActionDetail } from "../../../src/components/customers/IdeaActionDetail";
import { IdeaActionTag } from "../../../src/components/customers/IdeaActionTag";
import type { IdeaAction } from "../../../src/models/customerIdea";
import { MOCK_CUSTOMER_IDEAS } from "../../../src/test-data/customerIdeas";

const actions = MOCK_CUSTOMER_IDEAS.flatMap((idea) => (idea.action ? [idea.action] : []));
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
    render(<IdeaActionDetail action={null} />);
    expect(screen.getByRole("region", { name: "What they did" })).toHaveTextContent(/requesting a feature will be the first thing residents can do/);
  });

  it("shows a feature request with its intake reference, or that intake hasn't accepted it", () => {
    const request = ofType("REQUEST_FEATURE");
    const { rerender } = render(<IdeaActionDetail action={request} />);
    const section = screen.getByRole("region", { name: "What they did" });
    expect(within(section).getByText("Requested a feature")).toBeInTheDocument();
    expect(within(section).getByText(request.feature_request.title)).toBeInTheDocument();
    expect(within(section).getAllByText(/FR-000\d/).length).toBeGreaterThan(0);
    rerender(<IdeaActionDetail action={{ ...request, outcome: null, feature_request: { ...request.feature_request, reference_id: null } }} />);
    expect(screen.getByText("Not yet accepted by intake")).toBeInTheDocument();
  });

  it("shows an API check's request and response, and says when it didn't work", () => {
    const { rerender } = render(<IdeaActionDetail action={ofType("CHECK_STATUS_API")} />);
    expect(screen.getByText(/GET https:\/\/api\.boroughsim\.com\/orders\/01K7A1ATLANTIC000000000000\/status/)).toBeInTheDocument();
    expect(screen.getByText("HTTP 200")).toBeInTheDocument();
    expect(screen.getByText(/"scheduled": false/)).toBeInTheDocument();
    rerender(<IdeaActionDetail action={ofType("CHECK_STATUS_API", "FAILED")} />);
    expect(screen.getByText("HTTP 404")).toBeInTheDocument();
    expect(screen.getByText(/it didn't work/)).toBeInTheDocument();
  });

  it("shows a website visit as its recording", () => {
    render(<IdeaActionDetail action={ofType("BROWSE_WEBSITE")} />);
    expect(screen.getByRole("list", { name: "Recording steps" })).toBeInTheDocument();
    expect(screen.getByText(/found 41st Avenue on the map/)).toBeInTheDocument();
  });
});
