import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamChatPage } from "../../../src/components/pages/TeamChatPage";
import { useStaffMeetings } from "../../../src/hooks/useStaffMeetings";
import { MOCK_STAFF_MEETINGS } from "../../../src/test-data/staffMeetings";
import { inRouter } from "../team/teamFixtures";

vi.mock("../../../src/hooks/useStaffMeetings", () => ({ useStaffMeetings: vi.fn() }));

function meetings(state: Partial<ReturnType<typeof useStaffMeetings>>): void {
  vi.mocked(useStaffMeetings).mockReturnValue({ data: undefined, isLoading: false, error: null, ...state } as ReturnType<typeof useStaffMeetings>);
}

describe("TeamChatPage", () => {
  it("opens #executive-team with the Staff Meetings as messages, minutes attached, and switches to #tech-team", async () => {
    meetings({ data: MOCK_STAFF_MEETINGS });
    const user = userEvent.setup();
    render(inRouter(<TeamChatPage />, "/team/chat"));
    const executive = screen.getByRole("region", { name: "#executive-team" });
    expect(within(executive).getByLabelText("6 members")).toBeInTheDocument();
    expect(within(executive).getAllByText(/Staff Meeting minutes/)).toHaveLength(MOCK_STAFF_MEETINGS.length);
    expect(within(executive).getAllByRole("separator").length).toBeGreaterThan(1);
    expect(screen.getByRole("textbox", { name: "Message #executive-team" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /tech-team/ }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?channel=tech-team");
    const tech = screen.getByRole("region", { name: "#tech-team" });
    expect(within(tech).getByLabelText("4 members")).toBeInTheDocument();
    expect(within(tech).getByText(/Synth test 66s → 5.5s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tech-team/ })).toHaveAttribute("aria-current", "true");
  });

  it("says when the executive channel is loading or failed, and shows nothing for no meetings", () => {
    meetings({ isLoading: true });
    const { unmount } = render(inRouter(<TeamChatPage />, "/team/chat"));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading messages");
    unmount();
    meetings({ error: new Error("boom") });
    render(inRouter(<TeamChatPage />, "/team/chat?channel=nope"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load messages: boom");
  });
});
