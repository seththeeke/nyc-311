import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TeamChatChannel } from "../models/teamChatChannel";
import type { TeamChatMessage, TeamChatThread } from "../models/teamChatMessage";
import { teamChatService } from "../services/teamChatService";

/* Pseudo-real-time (docs/17-executive-team.md §10.6): every 5 s while the tab is visible, every 60 s when it isn't. */
export const VISIBLE_POLL_MS = 5_000;
export const HIDDEN_POLL_MS = 60_000;

export function pollInterval(): number {
  return document.visibilityState === "hidden" ? HIDDEN_POLL_MS : VISIBLE_POLL_MS;
}

/** Every public channel. Components call these hooks, never the service (CLAUDE.md §5.1). */
export function useChatChannels(): UseQueryResult<TeamChatChannel[], Error> {
  return useQuery({ queryKey: ["teamChat", "channels"], queryFn: () => teamChatService.listChannels(), refetchInterval: HIDDEN_POLL_MS });
}

/** A channel's newest top-level messages, oldest first for display, polled. */
export function useChannelMessages(channelId: string | null): UseQueryResult<TeamChatMessage[], Error> {
  return useQuery({
    queryKey: ["teamChat", "messages", channelId],
    queryFn: channelId ? async () => (await teamChatService.listMessages(channelId)).items.slice().reverse() : skipToken,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
  });
}

/** An open thread, polled while it's open. */
export function useChatThread(channelId: string | null, messageId: string | null): UseQueryResult<TeamChatThread, Error> {
  return useQuery({
    queryKey: ["teamChat", "thread", channelId, messageId],
    queryFn: channelId && messageId ? () => teamChatService.getThread(channelId, messageId) : skipToken,
    refetchInterval: pollInterval,
  });
}
