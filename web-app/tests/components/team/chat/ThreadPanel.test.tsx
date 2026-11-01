import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadPanel } from "../../../../src/components/team/chat/ThreadPanel";
import { useChatThread } from "../../../../src/hooks/useTeamChat";
import { inRouter } from "../teamFixtures";
import { chatMessage } from "./chatFixtures";

vi.mock("../../../../src/hooks/useTeamChat", () => ({ useChatThread: vi.fn() }));

function thread(state: Partial<ReturnType<typeof useChatThread>>): void {
  vi.mocked(useChatThread).mockReturnValue({ data: undefined, isLoading: false, error: null, ...state } as ReturnType<typeof useChatThread>);
}

describe("ThreadPanel", () => {
  it("shows the root and its replies, and closes", async () => {
    thread({ data: { root: chatMessage("T1"), replies: { items: [chatMessage("T1a")], next_cursor: null } } });
    render(inRouter(<ThreadPanel />, "/team/chat?channel=tech-team&thread=T1"));
    expect(vi.mocked(useChatThread)).toHaveBeenCalledWith("tech-team", "T1");
    expect(screen.getByRole("region", { name: "Thread" })).toHaveTextContent("# tech-team");
    expect(screen.getByRole("separator")).toHaveTextContent("1 reply");
    expect(screen.getByText(/Measured three runs/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close thread" }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?channel=tech-team");
  });

  it("prompts with no thread, and shows loading and errors", () => {
    thread({});
    const { unmount } = render(inRouter(<ThreadPanel />, "/team/chat"));
    expect(screen.getByText(/Open a thread/)).toBeInTheDocument();
    unmount();
    thread({ isLoading: true });
    const second = render(inRouter(<ThreadPanel />, "/team/chat?thread=T1"));
    expect(screen.getByText("Loading thread…")).toBeInTheDocument();
    second.unmount();
    thread({ error: new Error("boom") });
    const third = render(inRouter(<ThreadPanel />, "/team/chat?thread=T1"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the thread: boom");
    third.unmount();
    thread({});
    render(inRouter(<ThreadPanel />, "/team/chat?thread=T1"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the thread");
  });
});
