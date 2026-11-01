import { MOCK_TEAM_CHAT_CHANNELS, MOCK_TEAM_CHAT_MESSAGES } from "../../../../src/test-data/teamChat";
import type { TeamChatMessage } from "../../../../src/models/teamChatMessage";

export const [EXECUTIVE, TECH] = MOCK_TEAM_CHAT_CHANNELS;

export function chatMessage(id: string): TeamChatMessage {
  const found = MOCK_TEAM_CHAT_MESSAGES.find((message) => message.message_id === id);
  if (!found) throw new Error(`No mock message ${id}`);
  return found;
}
