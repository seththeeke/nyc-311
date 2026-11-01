import { config } from "../config";
import { TeamChatChannelListSchema, type TeamChatChannel } from "../models/teamChatChannel";
import { TeamChatMessagePageSchema, TeamChatThreadSchema, type TeamChatMessagePage, type TeamChatThread } from "../models/teamChatMessage";
import { MOCK_TEAM_CHAT_CHANNELS, MOCK_TEAM_CHAT_MESSAGES } from "../test-data/teamChat";

/*
 * Team Chat's open reads (docs/17-executive-team.md §10.4), from the chat
 * API at chat-api[.test].boroughsim.com. Read-only: the web app posts
 * nothing until the CEO's posting is built (§10.8).
 */
export interface TeamChatService {
  listChannels(): Promise<TeamChatChannel[]>;
  /** The newest top-level messages, newest first. */
  listMessages(channelId: string): Promise<TeamChatMessagePage>;
  getThread(channelId: string, messageId: string): Promise<TeamChatThread>;
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${config.chatApiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed: HTTP ${response.status}`);
  return response.json();
}

class LiveTeamChatService implements TeamChatService {
  async listChannels(): Promise<TeamChatChannel[]> {
    return TeamChatChannelListSchema.parse(await getJson("/channels")).items;
  }

  async listMessages(channelId: string): Promise<TeamChatMessagePage> {
    return TeamChatMessagePageSchema.parse(await getJson(`/channels/${encodeURIComponent(channelId)}/messages?limit=100`));
  }

  async getThread(channelId: string, messageId: string): Promise<TeamChatThread> {
    return TeamChatThreadSchema.parse(await getJson(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/thread?limit=100`));
  }
}

class MockTeamChatService implements TeamChatService {
  async listChannels(): Promise<TeamChatChannel[]> {
    return MOCK_TEAM_CHAT_CHANNELS.map((channel) => ({ ...channel }));
  }

  async listMessages(channelId: string): Promise<TeamChatMessagePage> {
    const items = MOCK_TEAM_CHAT_MESSAGES.filter((message) => message.channel_id === channelId && message.thread_id === null);
    return { items: [...items].sort((a, b) => b.message_id.localeCompare(a.message_id)), next_cursor: null };
  }

  async getThread(channelId: string, messageId: string): Promise<TeamChatThread> {
    const root = MOCK_TEAM_CHAT_MESSAGES.find((message) => message.channel_id === channelId && message.message_id === messageId);
    if (!root) throw new Error(`GET thread failed: HTTP 404`);
    return { root, replies: { items: MOCK_TEAM_CHAT_MESSAGES.filter((message) => message.thread_id === messageId), next_cursor: null } };
  }
}

/* VITE_TEAM_DATA_MODE overrides VITE_DATA_MODE for this service only, so a live dev server can show the mock. Never set by the pipeline. */
const TEAM_DATA_MODE = import.meta.env.VITE_TEAM_DATA_MODE || import.meta.env.VITE_DATA_MODE;

export const teamChatService: TeamChatService = TEAM_DATA_MODE === "live" ? new LiveTeamChatService() : new MockTeamChatService();
