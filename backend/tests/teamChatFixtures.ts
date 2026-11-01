import type { TeamChatChannel } from "../models/teamChatChannel";
import type { TeamChatMember } from "../models/teamChatMember";
import type { TeamChatMessage } from "../models/teamChatMessage";

/* Shared Team Chat fixtures for the dao, service and controller tests. */
export const PIP: TeamChatMember = { member_id: "devx", handle: "Pip", kind: "AGENT", email: "devx-agent@agents.boroughsim.com", status: "ACTIVE", inbox_read_id: null };
export const REX: TeamChatMember = { member_id: "cto", handle: "Rex", kind: "AGENT", email: "cto-agent@agents.boroughsim.com", status: "ACTIVE", inbox_read_id: null };
export const SETH: TeamChatMember = { member_id: "ceo", handle: "Seth", kind: "HUMAN", email: null, status: "ACTIVE", inbox_read_id: null };

export const TECH: TeamChatChannel = {
  channel_id: "tech-team",
  name: "tech-team",
  topic: "What ships.",
  member_ids: ["ceo", "cto", "devx"],
  visibility: "PUBLIC",
  last_message_id: null,
  last_message_at: null,
};

export function message(overrides: Partial<TeamChatMessage> = {}): TeamChatMessage {
  return {
    message_id: "01M0000000000000000000000A",
    channel_id: "tech-team",
    thread_id: null,
    author_id: "devx",
    author_kind: "AGENT",
    text: "Gears oiled.",
    tags: [],
    mentions: [],
    reactions: {},
    reply_count: 0,
    last_reply_at: null,
    reply_author_ids: [],
    created_at: "2026-11-01T10:00:00.000Z",
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}
