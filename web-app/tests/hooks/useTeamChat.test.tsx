import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { HIDDEN_POLL_MS, VISIBLE_POLL_MS, pollInterval, useChannelMessages, useChatChannels, useChatThread } from "../../src/hooks/useTeamChat";

vi.mock("../../src/services/teamChatService", async () => {
  const { MOCK_TEAM_CHAT_CHANNELS: channels, MOCK_TEAM_CHAT_MESSAGES: messages } = await import("../../src/test-data/teamChat");
  const top = (id: string) => messages.filter((m) => m.channel_id === id && m.thread_id === null).reverse();
  return {
    teamChatService: {
      listChannels: async () => [...channels],
      listMessages: async (id: string) => ({ items: top(id), next_cursor: null }),
      getThread: async (_channel: string, id: string) => ({ root: messages.find((m) => m.message_id === id), replies: { items: messages.filter((m) => m.thread_id === id), next_cursor: null } }),
    },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTeamChat", () => {
  it("loads channels, a channel's messages oldest first, and a thread from the mock", async () => {
    const channels = renderHook(() => useChatChannels(), { wrapper });
    await waitFor(() => expect(channels.result.current.data).toHaveLength(3));
    const messages = renderHook(() => useChannelMessages("tech-team"), { wrapper });
    await waitFor(() => expect(messages.result.current.data?.map((m) => m.message_id)).toEqual(["T1", "T2", "T3"]));
    const thread = renderHook(() => useChatThread("tech-team", "T1"), { wrapper });
    await waitFor(() => expect(thread.result.current.data?.root.message_id).toBe("T1"));
  });

  it("waits for a channel and a thread before fetching", () => {
    expect(renderHook(() => useChannelMessages(null), { wrapper }).result.current.fetchStatus).toBe("idle");
    expect(renderHook(() => useChatThread("tech-team", null), { wrapper }).result.current.fetchStatus).toBe("idle");
    expect(renderHook(() => useChatThread(null, "T1"), { wrapper }).result.current.fetchStatus).toBe("idle");
  });

  it("polls every 5 s while visible and every 60 s when hidden", () => {
    expect(pollInterval()).toBe(VISIBLE_POLL_MS);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    expect(pollInterval()).toBe(HIDDEN_POLL_MS);
  });
});
