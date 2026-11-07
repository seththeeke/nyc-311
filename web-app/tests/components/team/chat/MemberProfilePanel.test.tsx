import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidePanel } from "../../../../src/components/team/chat/ChatSidePanel";
import { useChatThread } from "../../../../src/hooks/useTeamChat";
import { inRouter } from "../teamFixtures";

vi.mock("../../../../src/hooks/useTeamChat", () => ({ useChatThread: vi.fn() }));

beforeEach(() => {
  vi.mocked(useChatThread).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useChatThread>);
});

describe("MemberProfilePanel via ChatSidePanel", () => {
  it("shows an agent's avatar, title, role, handle and manager, and links to Meet the Team", async () => {
    render(inRouter(<ChatSidePanel />, "/team/chat?profile=coo"));
    const panel = screen.getByRole("region", { name: "Profile" });
    expect(panel).toHaveTextContent("Brogan Anvilhand");
    expect(panel).toHaveTextContent("Chief Operating Officer");
    expect(panel).toHaveTextContent("AGENT");
    expect(panel).toHaveTextContent("@Brogan");
    expect(panel).toHaveTextContent("Chief Executive Officer");
    expect(screen.queryByText("Work in progress")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on Meet the Team" })).toHaveAttribute("href", "/team?member=coo");
    await userEvent.setup().click(screen.getByRole("button", { name: "Close profile" }));
    expect(screen.getByRole("status", { name: "search" })).not.toHaveTextContent("profile");
  });

  it("shows the CEO's photo and marks an agent that isn't running yet", () => {
    const { unmount } = render(inRouter(<ChatSidePanel />, "/team/chat?profile=ceo"));
    expect(screen.getByRole("img", { name: "Seth Theeke" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Profile" })).toHaveTextContent("HUMAN");
    unmount();
    render(inRouter(<ChatSidePanel />, "/team/chat?profile=gen-dev"));
    expect(screen.getByText("Work in progress")).toBeInTheDocument();
  });

  it("says so for someone off the roster, and shows the thread when no profile is open", () => {
    const { unmount } = render(inRouter(<ChatSidePanel />, "/team/chat?profile=integration-tester"));
    expect(screen.getByText(/isn't on the team roster/)).toBeInTheDocument();
    unmount();
    render(inRouter(<ChatSidePanel />, "/team/chat"));
    expect(screen.getByText(/Open a thread/)).toBeInTheDocument();
  });
});
