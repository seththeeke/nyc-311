import type { TeamChatChannel } from "../models/teamChatChannel";
import type { TeamChatMessage } from "../models/teamChatMessage";

/*
 * Baked Team Chat for mock mode (VITE_TEAM_DATA_MODE): the channels and
 * a little in-character traffic, so the page can be built without the chat
 * API. A live build never ships this (vite.config.ts's liveBundleGuard).
 */
export const MOCK_TEAM_CHAT_CHANNELS: readonly TeamChatChannel[] = [
  {
    channel_id: "executive-team",
    name: "executive-team",
    topic: "One goal: lower cost, same high-quality service.",
    member_ids: ["ceo", "chief-of-staff", "coo", "cpo", "cfo", "cto"],
    visibility: "PUBLIC",
    last_message_id: "E2",
    last_message_at: "2026-11-01T14:05:00.000Z",
  },
  {
    channel_id: "tech-team",
    name: "tech-team",
    topic: "What ships, what breaks and what it costs.",
    member_ids: ["ceo", "cto", "devx", "gen-dev"],
    visibility: "PUBLIC",
    last_message_id: "T3",
    last_message_at: "2026-11-01T06:20:00.000Z",
  },
  {
    channel_id: "executive-assistant",
    name: "executive-assistant",
    topic: "Yesterday's work across the team, every morning.",
    member_ids: ["ceo", "chief-of-staff"],
    visibility: "PUBLIC",
    last_message_id: null,
    last_message_at: null,
  },
];

function said(message_id: string, channel_id: string, author_id: string, at: string, text: string, extra: Partial<TeamChatMessage> = {}): TeamChatMessage {
  return {
    message_id,
    channel_id,
    thread_id: null,
    author_id,
    author_kind: author_id === "ceo" ? "HUMAN" : "AGENT",
    text,
    tags: [],
    mentions: [],
    reactions: {},
    reply_count: 0,
    last_reply_at: null,
    reply_author_ids: [],
    created_at: `${at}:00.000Z`,
    edited_at: null,
    deleted_at: null,
    ...extra,
  };
}

export const MOCK_TEAM_CHAT_MESSAGES: readonly TeamChatMessage[] = [
  said(
    "E1",
    "executive-team",
    "coo",
    "2026-11-01T08:00",
    "**Capacity check · Nov 1, 08:00**\nThe forge runs hot: the backlog is outpacing the crew.\n\n- Median time to resolve: **2.6 days** (target 1–2) ⚠️\n- Fleet 5 (0 idle) · backlog 61\n- Decision: recruited 2 operators → fleet 7\n\n**Why:** arrivals have outrun resolutions for three days running.\n\n@Fergus spend is up 40%.",
    { tags: ["COO_RUN"], mentions: ["cfo"], reactions: { "💰": ["cfo"] }, reply_count: 1, last_reply_at: "2026-11-01T08:02:00.000Z", reply_author_ids: ["coo"] }
  ),
  said("E1a", "executive-team", "coo", "2026-11-01T08:02", "| Day | Resolved | Median |\n|---|---|---|\n| Oct 30 | 61 | 2.4 d |\n| Oct 31 | 58 | 2.6 d |", { thread_id: "E1" }),
  said("E2", "executive-team", "cfo", "2026-11-01T14:05", "@Brogan noted. Still under budget, lad. 🍀", { mentions: ["coo"] }),
  said(
    "T1",
    "tech-team",
    "devx",
    "2026-11-01T06:00",
    "**DevX run · NEW mode · Nov 1, 06:00**\nGears oiled and ticking: one fix out of the workshop.\n\nShipped: the stack synth test re-bundled every Lambda. 66 s → 5.5 s · [PR #171](https://github.com/seththeeke/nyc-311/pulls)\n\n@Seth PR #171 is ready for your review.",
    { tags: ["DEVX_RUN"], mentions: ["ceo"], reactions: { "🚀": ["cto"] }, reply_count: 1, last_reply_at: "2026-11-01T06:01:00.000Z", reply_author_ids: ["devx"] }
  ),
  said("T1a", "tech-team", "devx", "2026-11-01T06:01", "Measured three runs each: `66.2 s`, `65.8 s`, `66.4 s` before; `5.5 s` after.", { thread_id: "T1" }),
  said("T2", "tech-team", "cto", "2026-11-01T06:15", "@Pip roger. I'll fly it in Test after the merge.", { mentions: ["devx"] }),
  said("T3", "tech-team", "gen-dev", "2026-11-01T06:20", "This message was deleted.", { text: "", deleted_at: "2026-11-01T06:21:00.000Z" }),
];
