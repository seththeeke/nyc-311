import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamChatPage } from "../../../src/components/pages/TeamChatPage";
import { useChannelMessages, useChatChannels } from "../../../src/hooks/useTeamChat";
import { MOCK_TEAM_CHAT_CHANNELS } from "../../../src/test-data/teamChat";
import { inRouter } from "../team/teamFixtures";
import { chatMessage } from "../team/chat/chatFixtures";

vi.mock("../../../src/hooks/useTeamChat", () => ({ useChatChannels: vi.fn(), useChannelMessages: vi.fn() }));

function state(channels: Partial<ReturnType<typeof useChatChannels>>, messages: Partial<ReturnType<typeof useChannelMessages>>): void {
  vi.mocked(useChatChannels).mockReturnValue({ data: undefined, isLoading: false, error: null, ...channels } as ReturnType<typeof useChatChannels>);
  vi.mocked(useChannelMessages).mockReturnValue({ data: undefined, isLoading: false, error: null, ...messages } as ReturnType<typeof useChannelMessages>);
}

describe("TeamChatPage", () => {
  it("opens the first channel, and switches channel by ?channel=", async () => {
    state({ data: [...MOCK_TEAM_CHAT_CHANNELS] }, { data: [chatMessage("E1"), chatMessage("E2")] });
    render(inRouter(<TeamChatPage />, "/team/chat"));
    expect(vi.mocked(useChannelMessages)).toHaveBeenLastCalledWith("executive-team");
    const executive = screen.getByRole("region", { name: "#executive-team" });
    expect(within(executive).getByLabelText("5 members")).toBeInTheDocument();
    expect(within(executive).getByText("COO_RUN")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /tech-team/ }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?channel=tech-team");
    expect(vi.mocked(useChannelMessages)).toHaveBeenLastCalledWith("tech-team");
    expect(screen.getByRole("button", { name: /tech-team/ })).toHaveAttribute("aria-current", "true");
  });

  it("says when channels or messages are loading or failed", () => {
    state({ isLoading: true }, {});
    const { unmount } = render(inRouter(<TeamChatPage />, "/team/chat"));
    expect(screen.getByText("Loading channels…")).toBeInTheDocument();
    expect(vi.mocked(useChannelMessages)).toHaveBeenLastCalledWith(null);
    unmount();
    state({ error: new Error("down") }, {});
    const second = render(inRouter(<TeamChatPage />, "/team/chat"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load channels: down");
    second.unmount();
    state({ data: [...MOCK_TEAM_CHAT_CHANNELS] }, { isLoading: true });
    const third = render(inRouter(<TeamChatPage />, "/team/chat?channel=nope"));
    expect(screen.getByText("Loading messages…")).toBeInTheDocument();
    third.unmount();
    state({ data: [...MOCK_TEAM_CHAT_CHANNELS] }, { error: new Error("boom") });
    render(inRouter(<TeamChatPage />, "/team/chat"));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load messages: boom");
  });
});
