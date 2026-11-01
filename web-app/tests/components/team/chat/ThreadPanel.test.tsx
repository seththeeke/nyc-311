import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadPanel } from "../../../../src/components/team/chat/ThreadPanel";
import { useStaffMeetings } from "../../../../src/hooks/useStaffMeetings";
import { MOCK_STAFF_MEETINGS } from "../../../../src/test-data/staffMeetings";
import { inRouter } from "../teamFixtures";

vi.mock("../../../../src/hooks/useStaffMeetings", () => ({ useStaffMeetings: vi.fn() }));

describe("ThreadPanel", () => {
  it("shows the message and its replies, and closes", async () => {
    vi.mocked(useStaffMeetings).mockReturnValue({ data: undefined } as ReturnType<typeof useStaffMeetings>);
    render(inRouter(<ThreadPanel />, "/team/chat?channel=tech-team&thread=T4"));
    expect(screen.getByRole("region", { name: "Thread" })).toHaveTextContent("# tech-team");
    expect(screen.getByRole("separator")).toHaveTextContent("3 replies");
    expect(screen.getByText(/Flown in Test/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close thread" }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?channel=tech-team");
    expect(screen.getByText(/Open a thread/)).toBeInTheDocument();
  });

  it("threads the Staff Meeting minutes in #executive-team, one reply per action item", () => {
    vi.mocked(useStaffMeetings).mockReturnValue({ data: MOCK_STAFF_MEETINGS } as ReturnType<typeof useStaffMeetings>);
    const meeting = MOCK_STAFF_MEETINGS[0];
    render(inRouter(<ThreadPanel />, `/team/chat?thread=${meeting.meeting_id}-minutes`));
    const count = meeting.action_items.length;
    expect(screen.getByRole("separator")).toHaveTextContent(`${count} ${count === 1 ? "reply" : "replies"}`);
  });

  it("opens a thread on a message with no replies yet", () => {
    vi.mocked(useStaffMeetings).mockReturnValue({ data: undefined } as ReturnType<typeof useStaffMeetings>);
    render(inRouter(<ThreadPanel />, "/team/chat?channel=tech-team&thread=T8"));
    expect(screen.getByRole("separator")).toHaveTextContent("0 replies");
  });
});
